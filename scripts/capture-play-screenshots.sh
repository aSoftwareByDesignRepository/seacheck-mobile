#!/usr/bin/env bash
# Capture live Play Store phone screenshots from a production APK on emulator.
#   SEACHECK_MAESTRO_DEVICE=emulator-5562 \
#   SEACHECK_RELEASE_APK=~/Downloads/apk-releases/seacheck-0.1.5-release.apk \
#   bash scripts/capture-play-screenshots.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERIAL="${SEACHECK_MAESTRO_DEVICE:-emulator-5562}"
OUT="$ROOT/docs/play-store/assets/screenshots"
RAW="$OUT/_raw-live"
APK="${SEACHECK_RELEASE_APK:-$HOME/Downloads/apk-releases/seacheck-0.1.5-release.apk}"
PKG=de.softwarebydesign.seacheck

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

mkdir -p "$RAW" "$OUT"
adb_s() { adb -s "$SERIAL" "$@"; }

echo "==> Device $SERIAL"
adb_s get-state >/dev/null

if [[ -f "$APK" ]]; then
  echo "==> Installing production APK: $APK"
  adb_s uninstall "$PKG" >/dev/null 2>&1 || true
  adb_s install -r "$APK"
else
  echo "WARN: APK missing at $APK — using installed app"
fi

adb_s shell settings put system system_locales en-US || true
adb_s shell am force-stop "$PKG" || true
adb_s shell pm clear "$PKG" >/dev/null 2>&1 || true
sleep 1
adb_s shell am start -W -n "$PKG/.MainActivity" >/dev/null
sleep 5

python3 - "$SERIAL" "$RAW" <<'PY'
import re, subprocess, sys, time
from pathlib import Path

serial, raw_dir = sys.argv[1], Path(sys.argv[2])
raw_dir.mkdir(parents=True, exist_ok=True)

def call(*args, check=True):
    return subprocess.run(
        ["adb", "-s", serial, *args],
        check=check,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def sh(*args):
    return subprocess.check_output(["adb", "-s", serial, *args], text=True, errors="replace")

def dump() -> str:
    call("shell", "uiautomator", "dump", "/sdcard/sc-cap.xml")
    return sh("shell", "cat", "/sdcard/sc-cap.xml")

def screencap(name: str):
    data = subprocess.check_output(["adb", "-s", serial, "exec-out", "screencap", "-p"])
    if not data.startswith(b"\x89PNG"):
        data = data.replace(b"\r\n", b"\n")
    path = raw_dir / name
    path.write_bytes(data)
    print(f"CAPTURED {name} ({path.stat().st_size} bytes)")

def find_bounds(
    xml: str,
    *,
    rid: str | None = None,
    text_exact: str | None = None,
    text_substr: str | None = None,
    clickable_only: bool = False,
):
    for node in re.finditer(r"<node[^>]+>", xml):
        n = node.group(0)
        if rid and f'resource-id="{rid}"' not in n:
            continue
        if text_exact is not None:
            if f'text="{text_exact}"' not in n and f'content-desc="{text_exact}"' not in n:
                continue
        elif text_substr:
            if text_substr not in n:
                continue
        if rid is None and text_exact is None and text_substr is None:
            continue
        if clickable_only and 'clickable="true"' not in n:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        # Skip zero/inverted bounds (off-screen RN nodes)
        if x2 <= x1 or y2 <= y1:
            continue
        if y2 < 80:
            continue
        return (x1 + x2) // 2, (y1 + y2) // 2, (x1, y1, x2, y2)
    return None

def has_rid(xml: str, rid: str) -> bool:
    return f'resource-id="{rid}"' in xml

def scroll_down():
    call("shell", "input", "swipe", "540", "1700", "540", "600", "400")
    time.sleep(0.7)

def tap_xy(x: int, y: int):
    call("shell", "input", "tap", str(x), str(y))
    time.sleep(1.0)

def ensure_visible_and_tap(rid: str, *, text_substr: str | None = None, scrolls: int = 8) -> bool:
    for i in range(scrolls + 1):
        dismiss_perm(max_rounds=2)
        xml = dump()
        hit = find_bounds(xml, rid=rid) or (
            find_bounds(xml, text_substr=text_substr, clickable_only=True) if text_substr else None
        )
        if hit:
            x, y, box = hit
            # If mostly below fold, scroll once more
            if box[3] > 2100 and i < scrolls:
                scroll_down()
                continue
            print(f"TAP {rid or text_substr} @{x},{y} box={box}")
            tap_xy(x, y)
            return True
        scroll_down()
    print(f"FAIL tap {rid or text_substr}")
    return False

def wait_rid(rids: list[str], timeout: float = 60) -> str | None:
    end = time.time() + timeout
    while time.time() < end:
        dismiss_perm(max_rounds=2)
        xml = dump()
        for rid in rids:
            if has_rid(xml, rid):
                return rid
        time.sleep(0.8)
    return None

def dismiss_perm(max_rounds: int = 6) -> int:
    """Dismiss system permission dialogs. Prefer resource-ids / exact button text."""
    rid_prefs = (
        "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
        "com.android.permissioncontroller:id/permission_allow_button",
        "com.android.permissioncontroller:id/permission_allow_one_time_button",
        "com.android.permissioncontroller:id/permission_deny_button",
        "com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button",
    )
    exact_labels = (
        "While using the app",
        "Allow only while using the app",
        "Only this time",
        "Allow",
        "Don’t allow",
        "Don't allow",
        "Deny",
        "No thanks",
    )
    dismissed = 0
    for _ in range(max_rounds):
        xml = dump()
        if "permissioncontroller" not in xml and "permission_allow" not in xml:
            # Still try exact Allow/Deny in case package differs
            if not any(f'text="{lab}"' in xml for lab in ("Allow", "While using the app", "Don’t allow", "Don't allow")):
                break
        hit = None
        label = None
        for rid in rid_prefs:
            hit = find_bounds(xml, rid=rid)
            if hit:
                label = rid.split("/")[-1]
                break
        if not hit:
            for lab in exact_labels:
                hit = find_bounds(xml, text_exact=lab, clickable_only=True)
                if hit:
                    label = lab
                    break
        if not hit:
            break
        print(f"DISMISS {label}")
        tap_xy(hit[0], hit[1])
        time.sleep(0.9)
        dismissed += 1
    return dismissed

# ---- 1 Disclaimer (with continue visible) ----
assert wait_rid(["screen.onboarding"], 40), "onboarding missing"
# Scroll until continue is on screen for a good Play shot
for _ in range(10):
    xml = dump()
    hit = find_bounds(xml, rid="onboarding.disclaimer.continue") or find_bounds(
        xml, text_substr="I understand"
    )
    # hit = (x, y, (x1, y1, x2, y2)); continue must be above the fold
    if hit and hit[2][3] < 2000:
        break
    scroll_down()
screencap("01-disclaimer.png")
assert ensure_visible_and_tap(
    "onboarding.disclaimer.continue", text_substr="I understand"
), "could not continue disclaimer"

# ---- location / battery / finish ----
time.sleep(1.5)
assert (
    ensure_visible_and_tap("onboarding.location.skip", text_substr="Continue without background", scrolls=4)
    or ensure_visible_and_tap("onboarding.location.continue", text_substr="Continue", scrolls=4)
), "location step"
dismiss_perm()
time.sleep(1)
assert ensure_visible_and_tap("onboarding.battery.ack", text_substr="Got it", scrolls=6), "battery ack"
time.sleep(1)
assert (
    ensure_visible_and_tap("onboarding.finish", text_substr="Open SeaCheck", scrolls=6)
    or ensure_visible_and_tap("onboarding.finish", text_substr="Finish", scrolls=4)
), "finish"
dismiss_perm()
time.sleep(2)

# ---- 2 Map ----
assert wait_rid(["tab.map", "screen.map"], 75), "map not ready"
dismiss_perm()
time.sleep(3)
screencap("02-map.png")

# ---- 3 Passage ----
assert ensure_visible_and_tap("tab.passage", scrolls=1) or (
    ensure_visible_and_tap("tab.more", scrolls=1) and ensure_visible_and_tap("tab.passage", scrolls=2)
), "passage tab"
time.sleep(2)
screencap("03-passage.png")

# ---- 4 Downloads ----
ensure_visible_and_tap("tab.more", scrolls=1)
time.sleep(0.5)
assert ensure_visible_and_tap("tab.downloads", scrolls=2), "downloads tab"
time.sleep(2)
for _ in range(5):
    scroll_down()
screencap("04-downloads.png")

# ---- 5 Offline map ----
call("shell", "cmd", "connectivity", "airplane-mode", "enable", check=False)
time.sleep(2)
ensure_visible_and_tap("tab.map", scrolls=1)
time.sleep(3)
screencap("05-offline-map.png")
call("shell", "cmd", "connectivity", "airplane-mode", "disable", check=False)
time.sleep(2)

# ---- 6 About ----
ensure_visible_and_tap("tab.more", scrolls=1)
time.sleep(0.5)
assert ensure_visible_and_tap("tab.settings", scrolls=2), "settings"
time.sleep(1.5)
assert ensure_visible_and_tap("settings.menu.about", text_substr="About", scrolls=6), "about"
time.sleep(1.5)
screencap("06-about.png")

print("RAW_DONE")
PY

python3 - "$RAW" "$OUT" <<'PY'
from pathlib import Path
import sys
from PIL import Image

raw, out = Path(sys.argv[1]), Path(sys.argv[2])
# GRAPHICS.md order: 1 map, 2 disclaimer, 3 passage, 4 downloads, 5 offline, 6 about
mapping = {
    "02-map.png": "phone-01-map.png",
    "01-disclaimer.png": "phone-02-disclaimer.png",
    "03-passage.png": "phone-03-passage.png",
    "04-downloads.png": "phone-04-downloads.png",
    "05-offline-map.png": "phone-05-offline.png",
    "06-about.png": "phone-06-about.png",
}
TW, TH = 1080, 1920

def fit(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(TW / sw, TH / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - TW) // 2, (nh - TH) // 2
    return im.crop((left, top, left + TW, top + TH))

for src_name, dest_name in mapping.items():
    src = raw / src_name
    if not src.exists():
        raise SystemExit(f"missing raw {src}")
    img = fit(Image.open(src))
    dest = out / dest_name
    img.save(dest, "PNG", optimize=True)
    print(f"WROTE {dest.name} {img.size} {dest.stat().st_size // 1024}KB")
print("NORMALIZE_DONE")
PY

echo "==> Syncing fastlane phoneScreenshots (en-US + de-DE)"
for loc in en-US de-DE; do
  DEST="$ROOT/fastlane/metadata/android/$loc/images/phoneScreenshots"
  mkdir -p "$DEST"
  cp -f "$OUT/phone-01-map.png" "$DEST/1.png"
  cp -f "$OUT/phone-02-disclaimer.png" "$DEST/2.png"
  cp -f "$OUT/phone-03-passage.png" "$DEST/3.png"
  cp -f "$OUT/phone-04-downloads.png" "$DEST/4.png"
  cp -f "$OUT/phone-05-offline.png" "$DEST/5.png"
  cp -f "$OUT/phone-06-about.png" "$DEST/6.png"
done

echo "==> Live shots ready"
ls -lh "$OUT"/phone-0*.png
echo "Tip: npm run appstore:screenshots  # refresh framed iPhone/iPad assets"
