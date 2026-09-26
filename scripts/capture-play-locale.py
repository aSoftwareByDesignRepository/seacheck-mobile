#!/usr/bin/env python3
"""SeaCheck Play Store phone capture — one locale per run.

Shot list (store-farm/seacheck-play-shot-list.md):
  1 map hero + live GPS
  2 map + active passage
  3 passage detail (≥2 WPs)
  4 downloads
  5 tracks (seeded log) — differs meaningfully from shot 02
  6 safety notice (full disclaimer)
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

PKG = "de.softwarebydesign.seacheck"
TW, TH = 1080, 1920

# Demo voyage is a seeded Rostock → Kopenhagen Baltic route (see
# seed-demo-data.py). The injected GPS fix sits on leg 2, just south of
# Gedser Odde, so the active route + waypoint markers share the frame.
GPS_LON, GPS_LAT = 11.9850, 54.4700


def adb(serial: str, *args: str, check: bool = True, timeout: float = 30) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["adb", "-s", serial, *args],
            check=check,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        print(f"WARN adb timeout: {' '.join(args[:4])}…", flush=True)
        if check:
            raise
        return subprocess.CompletedProcess(e.cmd or [], 124, "", "timeout")


def adb_bytes(serial: str, *args: str) -> bytes:
    return subprocess.check_output(["adb", "-s", serial, *args], timeout=45)


def sh(serial: str, *args: str) -> str:
    return adb(serial, *args, check=False).stdout


def dump(serial: str) -> str:
    """UI hierarchy dump with hard timeout — plain uiautomator dump can hang on MapLibre."""
    adb(serial, "shell", "rm", "-f", "/data/local/tmp/sc-cap.xml", check=False, timeout=5)
    # --compressed is faster/less likely to wedge on dense map views
    r = adb(
        serial,
        "shell",
        "uiautomator",
        "dump",
        "--compressed",
        "/data/local/tmp/sc-cap.xml",
        check=False,
        timeout=12,
    )
    def _read() -> str:
        o = adb(serial, "shell", "cat", "/data/local/tmp/sc-cap.xml", check=False, timeout=8)
        return o.stdout or ""

    out = _read() if r.returncode == 0 else ""
    # --compressed can emit a degenerate single-node tree when a modal sheet
    # (separate window) is up — retry uncompressed when the tree is a stub.
    if r.returncode != 0 or out.count("<node") < 3:
        r = adb(
            serial,
            "shell",
            "uiautomator",
            "dump",
            "/data/local/tmp/sc-cap.xml",
            check=False,
            timeout=10,
        )
        if r.returncode == 0:
            out = _read()
    if not out:
        print("WARN uiautomator dump failed", flush=True)
    return out


def screencap(serial: str, path: Path) -> None:
    data = adb_bytes(serial, "exec-out", "screencap", "-p")
    if not data.startswith(b"\x89PNG"):
        data = data.replace(b"\r\n", b"\n")
    path.write_bytes(data)
    print(f"CAPTURED {path.name} ({path.stat().st_size} bytes)", flush=True)


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
        if x2 <= x1 or y2 <= y1 or y2 < 80:
            continue
        return (x1 + x2) // 2, (y1 + y2) // 2, (x1, y1, x2, y2)
    return None


def has_rid(xml: str, rid: str) -> bool:
    return f'resource-id="{rid}"' in xml


def tap_xy(serial: str, x: int, y: int) -> None:
    adb(serial, "shell", "input", "tap", str(x), str(y), check=False)
    time.sleep(0.9)


def scroll_down(serial: str) -> None:
    adb(serial, "shell", "input", "swipe", "540", "1700", "540", "600", "400", check=False)
    time.sleep(0.6)


def dismiss_perm(serial: str, max_rounds: int = 6) -> None:
    rid_prefs = (
        "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
        "com.android.permissioncontroller:id/permission_allow_button",
        "com.android.permissioncontroller:id/permission_allow_one_time_button",
    )
    labels = (
        "While using the app",
        "Allow only while using the app",
        "Nur bei Nutzung der App",
        "Nur dieses Mal",
        "While using the app",
        "Allow",
        "Zulassen",
        "Only this time",
        # fr / es / it
        "Lorsque vous utilisez l’appli",
        "Uniquement cette fois",
        "Autoriser",
        "Mientras usas la app",
        "Mientras usas la aplicación",
        "Solo esta vez",
        "Permitir",
        "Solo mentre usi l’app",
        "Solo questa volta",
        "Consenti",
        # nl / pl
        "Tijdens gebruik van de app",
        "Alleen deze keer",
        "Toestaan",
        "Podczas korzystania z aplikacji",
        "Tylko tym razem",
        "Zezwól",
        # sv / nb / da
        "När du använder appen",
        "Endast den här gången",
        "Tillåt",
        "Mens du bruker appen",
        "Bare denne gangen",
        "Mens du bruger appen",
        "Kun denne gang",
        "Tillad",
        # pt
        "Ao usar a app",
        "Ao usar a aplicação",
        "Apenas desta vez",
        "Permitir",
    )
    for _ in range(max_rounds):
        xml = dump(serial)
        hit = None
        for rid in rid_prefs:
            hit = find_bounds(xml, rid=rid)
            if hit:
                break
        if not hit:
            for lab in labels:
                hit = find_bounds(xml, text_exact=lab, clickable_only=True)
                if hit:
                    break
        if not hit:
            return
        tap_xy(serial, hit[0], hit[1])
        time.sleep(0.7)


def ensure_tap(
    serial: str,
    rid: str | None = None,
    *,
    text_substr: str | None = None,
    text_exact: str | None = None,
    scrolls: int = 8,
) -> bool:
    for i in range(scrolls + 1):
        dismiss_perm(serial, max_rounds=2)
        xml = dump(serial)
        hit = None
        if rid:
            hit = find_bounds(xml, rid=rid)
        if not hit and text_exact:
            hit = find_bounds(xml, text_exact=text_exact, clickable_only=True)
        if not hit and text_substr:
            hit = find_bounds(xml, text_substr=text_substr, clickable_only=True) or find_bounds(
                xml, text_substr=text_substr
            )
        if hit:
            # Pixel 3 is 2160 tall — allow taps near bottom chrome
            if hit[2][3] > 2140 and i < scrolls:
                scroll_down(serial)
                continue
            print(f"TAP {rid or text_exact or text_substr} @{hit[0]},{hit[1]}", flush=True)
            tap_xy(serial, hit[0], hit[1])
            return True
        scroll_down(serial)
    print(f"FAIL tap {rid or text_exact or text_substr}", flush=True)
    return False


def wait_rid(serial: str, rids: list[str], timeout: float = 75) -> str | None:
    end = time.time() + timeout
    while time.time() < end:
        dismiss_perm(serial, max_rounds=2)
        xml = dump(serial)
        for rid in rids:
            if has_rid(xml, rid):
                return rid
        time.sleep(0.7)
    return None


# Quick-settings/notification shade resource markers (SystemUI)
_SHADE_MARKERS = ("qs_panel", "quick_settings_panel", "expanded_status_bar", "notification_panel")


def shade_open(xml: str) -> bool:
    return "com.android.systemui:id/" in xml and any(
        f"com.android.systemui:id/{m}" in xml for m in _SHADE_MARKERS
    )


def ensure_app_foreground(serial: str, *, relaunch: bool = True) -> bool:
    """BACK out of system shade/sheets; relaunch as last resort.

    A wedged overlay or a pulled-down quick-settings shade makes every
    subsequent screencap worthless — guard before each capture.
    """
    for _ in range(5):
        xml = dump(serial)
        if not shade_open(xml) and (
            has_rid(xml, "tab.map") or has_rid(xml, "tab.passage") or has_rid(xml, "screen.map")
        ):
            return True
        adb(serial, "shell", "input", "keyevent", "4", check=False, timeout=5)
        time.sleep(0.7)
    if not relaunch:
        return False
    # Cold relaunch — onboarding state is persisted, lands back on the map.
    adb(serial, "shell", "wm", "dismiss-keyguard", check=False, timeout=8)
    adb(serial, "shell", "am", "force-stop", PKG, check=False, timeout=8)
    time.sleep(1)
    adb(
        serial,
        "shell",
        "monkey",
        "-p",
        PKG,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
        check=False,
        timeout=15,
    )
    wait_rid(serial, ["tab.map", "screen.map"], 60)
    geo_fix(serial, steps=10)
    xml = dump(serial)
    return not shade_open(xml) and (has_rid(xml, "tab.map") or has_rid(xml, "screen.map"))


def geo_fix(serial: str, *, steps: int = 16, settle: bool = True, speed_kn: float = 6.5) -> None:
    """Inject a moving GPS fix on the seeded Rostock→Kopenhagen leg.

    Emulator: `geo fix <lon> <lat> [<alt> [<sats> [<velocity_kn>]]]`.
    Small steps + explicit velocity → underway SOG without outlier chip.
    """
    adb(serial, "shell", "settings", "put", "secure", "location_mode", "3", check=False)
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", check=False)
    lon, lat = GPS_LON, GPS_LAT
    # Small steps + explicit velocity → underway SOG without outlier chip
    dlon_step = 0.000040
    dlat_step = 0.000025
    for i in range(steps):
        adb(
            serial,
            "emu",
            "geo",
            "fix",
            f"{lon + dlon_step * i:.6f}",
            f"{lat + dlat_step * i:.6f}",
            "3",
            "12",
            f"{speed_kn:.1f}",
            check=False,
        )
        time.sleep(0.65)
    if settle:
        adb(
            serial,
            "emu",
            "geo",
            "fix",
            f"{lon + dlon_step * (steps - 1):.6f}",
            f"{lat + dlat_step * (steps - 1):.6f}",
            "3",
            "12",
            f"{speed_kn:.1f}",
            check=False,
        )


def wait_clean_gps_chrome(serial: str, timeout: float = 35) -> None:
    """Wait until Jump filtered / Sprung gefiltert chip is gone; keep velocity SOG alive."""
    end = time.time() + timeout
    while time.time() < end:
        geo_fix(serial, steps=4, settle=True)
        xml = dump(serial)
        if "Jump filtered" not in xml and "Sprung gefiltert" not in xml and 'gpsStatus.outlier"' not in xml:
            return
        time.sleep(0.4)
    print("WARN outlier chip still present", flush=True)


def fit_phone(im: Image.Image, *, anchor: str = "bottom") -> Image.Image:
    """Fit to 1080×1920. Bottom-anchor keeps sticky CTA / tab bar (center crop clipped #6)."""
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(TW / sw, TH / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TW) // 2
    if anchor == "top":
        top = 0
    elif anchor == "center":
        top = (nh - TH) // 2
    else:
        top = max(0, nh - TH)
    return im.crop((left, top, left + TW, top + TH))


def seed_databases(serial: str) -> None:
    """Push pre-built demo DBs (Rostock→Kopenhagen passage, track, vessel).

    Deterministic replacement for the old tap-driven waypoint entry — the app
    hydrates the seeded SQLite stores on first launch after `pm clear`.
    Requires adbd as root (Atlas images are userdebug). Skip `adb root` when
    already root: a no-op request restarts adbd and can race the farm lock
    sweeper seeing the serial briefly absent.
    """
    if sh(serial, "shell", "id", "-u").strip() != "0":
        adb(serial, "root", check=False, timeout=20)
        adb(serial, "wait-for-device", check=False, timeout=20)
        time.sleep(2)
    tmp = Path(tempfile.mkdtemp(prefix="sc-seed-"))
    try:
        subprocess.run(
            [sys.executable, str(Path(__file__).resolve().with_name("seed-demo-data.py")),
             "--out-dir", str(tmp)],
            check=True,
        )
        files_dir = f"/data/data/{PKG}/files/SQLite"
        db_dir = f"/data/data/{PKG}/databases"
        adb(serial, "shell", "mkdir", "-p", files_dir, db_dir, check=False)
        adb(serial, "push", str(tmp / "seacheck.db"), f"{files_dir}/seacheck.db", check=True)
        adb(serial, "push", str(tmp / "RKStorage"), f"{db_dir}/RKStorage", check=True)
        # adbd-created dirs/files are root-owned with a foreign SELinux
        # category — hand everything to the app uid and restore context.
        owner = sh(serial, "shell", "stat", "-c", "%u:%g", f"/data/data/{PKG}").strip()
        for target in (files_dir, db_dir, f"{files_dir}/seacheck.db", f"{db_dir}/RKStorage"):
            adb(serial, "shell", "chown", "-R", owner, target, check=False)
            adb(serial, "shell", "restorecon", "-R", target, check=False)
        for f in (f"{files_dir}/seacheck.db", f"{db_dir}/RKStorage"):
            adb(serial, "shell", "chmod", "660", f, check=False)
        print("SEEDED demo databases pushed", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)



def dismiss_download_banner(serial: str) -> None:
    xml = dump(serial)
    for lab in (
        "Dismiss",
        "Schließen",
        "Close",
        "Got it",
        "Verstanden",
        "Not now",
        "Nicht jetzt",
        "Later",
        "Später",
    ):
        hit = find_bounds(xml, text_exact=lab, clickable_only=True) or find_bounds(
            xml, text_substr=lab, clickable_only=True
        )
        if hit:
            tap_xy(serial, hit[0], hit[1])
            time.sleep(0.5)
            return
    # Heuristic: tap X in top-right of the download toast
    if "Download a region pack" in xml or "Regionenpaket" in xml or "Wi-Fi" in xml or "WLAN" in xml:
        for x, y in ((1000, 180), (980, 160), (1020, 200), (1000, 220), (1040, 150)):
            tap_xy(serial, x, y)
            time.sleep(0.25)

def run(locale: str, serial: str, apk: Path, out_docs: Path, fastlane_dest: Path) -> None:
    raw = out_docs / f"_raw-live-{locale}"
    raw.mkdir(parents=True, exist_ok=True)
    out_docs.mkdir(parents=True, exist_ok=True)
    fastlane_dest.mkdir(parents=True, exist_ok=True)

    print(f"==> Locale {locale} on {serial}", flush=True)
    lang = locale if "-" in locale else ("de-DE" if locale.startswith("de") else "en-US")
    adb(serial, "shell", "settings", "put", "system", "system_locales", lang, check=False)
    adb(serial, "uninstall", PKG, check=False)
    adb(serial, "install", "-r", str(apk), check=True)
    # Per-app locales (API 33+) — system_locales alone often leaves expo-localization on en
    adb(serial, "shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, check=False)
    adb(serial, "shell", "am", "force-stop", PKG, check=False)
    adb(serial, "shell", "pm", "clear", PKG, check=False)
    time.sleep(1)
    # Re-apply after clear
    adb(serial, "shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, check=False)
    adb(serial, "shell", "pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS", check=False)
    # Seed passage/waypoints/track/vessel BEFORE first launch — deterministic,
    # no flaky map-tap waypoint entry. Onboarding still runs (shot 06 needs it).
    seed_databases(serial)
    # NOTE: do NOT pre-grant location here — resumeStep() would skip the
    # disclaimer step entirely and the 06-safety shot could never be taken.
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", check=False)
    adb(serial, "shell", "settings", "put", "secure", "location_mode", "3", check=False)
    # swipe lockscreen blocks am start foregrounding — dismiss before launch
    adb(serial, "shell", "wm", "dismiss-keyguard", check=False, timeout=8)
    adb(serial, "shell", "input", "keyevent", "KEYCODE_WAKEUP", check=False, timeout=8)
    adb(serial, "shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", check=False)
    time.sleep(5)

    # --- Onboarding state machine; capture safety while disclaimer is visible ---
    assert wait_rid(serial, ["screen.onboarding"], 50), "onboarding missing"
    safety_done = False
    end = time.time() + 180
    while time.time() < end:
        dismiss_perm(serial, max_rounds=2)
        xml = dump(serial)
        if has_rid(xml, "tab.map") or has_rid(xml, "screen.map"):
            break
        if has_rid(xml, "onboarding.disclaimer.continue") or "I understand" in xml or "Ich verstehe" in xml:
            if not safety_done:
                # Stay at top: full disclaimer from sentence start. Bottom-anchor crop
                # keeps sticky CTA without center-cropping text under the button.
                for _ in range(3):
                    adb(serial, "shell", "input", "swipe", "540", "700", "540", "1500", "250", check=False)
                    time.sleep(0.25)
                time.sleep(0.4)
                screencap(serial, raw / "06-safety.png")
                safety_done = True
            ensure_tap(serial, "onboarding.disclaimer.continue", scrolls=4) or ensure_tap(
                serial, text_substr="I understand", scrolls=3
            ) or ensure_tap(serial, text_substr="Ich verstehe", scrolls=3)
            time.sleep(0.8)
            continue
        if has_rid(xml, "confirm.sheet") or has_rid(xml, "confirm.proceed"):
            # Prefer allow location so GPS instruments populate
            ensure_tap(serial, "confirm.proceed", scrolls=2) or ensure_tap(
                serial, text_substr="Allow location", scrolls=2
            )
            dismiss_perm(serial)
            for perm in (
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.ACCESS_COARSE_LOCATION",
            ):
                adb(serial, "shell", "pm", "grant", PKG, perm, check=False)
            time.sleep(0.6)
            # If still blocked, continue limited
            xml2 = dump(serial)
            if has_rid(xml2, "confirm.cancel"):
                ensure_tap(serial, "confirm.cancel", scrolls=1) or ensure_tap(
                    serial, text_substr="Continue without", scrolls=1
                )
            continue
        if has_rid(xml, "onboarding.location.skip") or has_rid(xml, "onboarding.location.continue") or has_rid(
            xml, "onboarding.location.foreground"
        ):
            # Request foreground FIRST: fires the system dialog directly (the
            # Continue path routes through a modal ConfirmSheet that uiautomator
            # --compressed dumps as a stub tree). Once granted the foreground
            # button unmounts and we fall through to Continue → battery step.
            ensure_tap(serial, "onboarding.location.foreground", scrolls=2) or ensure_tap(
                serial, "onboarding.location.continue", scrolls=3
            ) or ensure_tap(serial, text_substr="Continue", scrolls=2) or ensure_tap(
                serial, "onboarding.location.skip", scrolls=2
            )
            dismiss_perm(serial)
            for perm in (
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.ACCESS_COARSE_LOCATION",
            ):
                adb(serial, "shell", "pm", "grant", PKG, perm, check=False)
            geo_fix(serial)
            time.sleep(0.6)
            continue
        if has_rid(xml, "onboarding.battery.ack"):
            ensure_tap(serial, "onboarding.battery.ack", scrolls=3) or ensure_tap(
                serial, text_substr="Got it", scrolls=2
            ) or ensure_tap(serial, text_substr="Verstanden", scrolls=2)
            time.sleep(0.6)
            continue
        if has_rid(xml, "onboarding.finish"):
            ensure_tap(serial, "onboarding.finish", scrolls=3) or ensure_tap(
                serial, text_substr="Open SeaCheck", scrolls=2
            ) or ensure_tap(serial, text_substr="SeaCheck öffnen", scrolls=2)
            dismiss_perm(serial)
            time.sleep(1)
            continue
        # Unknown onboarding chrome — nudge
        scroll_down(serial)
        time.sleep(0.5)
    assert safety_done, "safety disclaimer shot missing"
    # Final confirm/perm cleanup before map wait
    for _ in range(8):
        xml = dump(serial)
        if has_rid(xml, "tab.map") or has_rid(xml, "screen.map"):
            break
        if has_rid(xml, "confirm.proceed"):
            ensure_tap(serial, "confirm.proceed", scrolls=1)
            dismiss_perm(serial)
            adb(serial, "shell", "pm", "grant", PKG, "android.permission.ACCESS_FINE_LOCATION", check=False)
            continue
        if has_rid(xml, "confirm.cancel"):
            ensure_tap(serial, "confirm.cancel", scrolls=1)
            continue
        if has_rid(xml, "onboarding.battery.ack"):
            ensure_tap(serial, "onboarding.battery.ack", scrolls=1)
            continue
        if has_rid(xml, "onboarding.finish"):
            ensure_tap(serial, "onboarding.finish", scrolls=1)
            continue
        dismiss_perm(serial)
        time.sleep(0.5)
    if not wait_rid(serial, ["tab.map", "screen.map"], 90):
        # Debug artifact: capture the blocking UI state for diagnosis
        dbg_xml = dump(serial)
        (raw / "DEBUG-stuck.xml").write_text(dbg_xml or "<empty/>")
        screencap(serial, raw / "DEBUG-stuck.png")
        raise AssertionError("map not ready")
    dismiss_perm(serial)
    # Grant location early; inject underway track on open water (no Jump filtered)
    for perm in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
    ):
        adb(serial, "shell", "pm", "grant", PKG, perm, check=False)
    geo_fix(serial, steps=20)
    dismiss_download_banner(serial)
    wait_clean_gps_chrome(serial, timeout=50)
    dismiss_download_banner(serial)
    # Nudge camera slightly so any residual pier scribble leaves the hero
    adb(serial, "shell", "input", "swipe", "700", "900", "400", "900", "280", check=False)
    time.sleep(0.8)
    geo_fix(serial, steps=8)
    wait_clean_gps_chrome(serial, timeout=30)
    screencap(serial, raw / "01-map-hero.png")

    # The seeded Rostock→Kopenhagen passage is already active — just ensure a
    # clean foreground before the route shot.
    if not ensure_app_foreground(serial):
        print("WARN could not recover clean foreground before 02", flush=True)
    ensure_tap(serial, "tab.map", scrolls=2)
    time.sleep(2)
    dismiss_download_banner(serial)
    wait_clean_gps_chrome(serial, timeout=40)
    geo_fix(serial, steps=6)
    time.sleep(1)
    if ensure_app_foreground(serial):
        screencap(serial, raw / "02-map-passage.png")

    # Passage detail — named + waypoint list
    ensure_app_foreground(serial)
    ensure_tap(serial, "tab.passage", scrolls=2)
    time.sleep(1)
    xml = dump(serial)
    if has_rid(xml, "passage.empty") or "passage.card." in xml:
        m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml) or re.search(
            r'resource-id="passage\.card\.[^"]+"', xml
        )
        if m:
            ensure_tap(serial, m.group(0).split('"')[1], scrolls=2)
            time.sleep(1.2)
    wait_rid(serial, ["passage.detail", "passage.waypoints", "passage.routeSummary", "passage.meta"], 20)
    # Scroll so route summary + waypoint list are visible
    for _ in range(2):
        scroll_down(serial)
    adb(serial, "shell", "input", "swipe", "540", "900", "540", "1400", "300", check=False)
    time.sleep(0.6)
    screencap(serial, raw / "03-passage-detail.png")

    # Shot 05 — Tracks list with the seeded log (meaningfully different from
    # the shot-02 map; the shot list allows "offline map OR tracks").
    # Captured BEFORE the pack seal: an active download blocks every tab tap
    # (guardDownloadTabPress), so this must happen while navigation is free.
    ensure_app_foreground(serial)
    ensure_tap(serial, "tab.tracks", scrolls=3) or ensure_tap(
        serial, text_substr="Tracks", scrolls=2
    ) or ensure_tap(serial, text_substr="Törn", scrolls=2)
    time.sleep(1.5)
    if not wait_rid(serial, ["screen.tracks"], 15):
        print("WARN screen.tracks not reached before 05 capture", flush=True)
    screencap(serial, raw / "05-tracks.png")

    # Shot 04 — Downloads catalog. No live pack seal: an active download
    # blocks every tab tap (guardDownloadTabPress) and the OSM/OpenSeaMap tile
    # fetch stalls for many minutes on the farm — meanwhile shots 04/05
    # captured the blocking map overlay instead of their screens. The catalog
    # renders every region pack with Download/Ready CTAs regardless.
    ensure_app_foreground(serial)
    ensure_tap(serial, "tab.downloads", scrolls=2) or ensure_tap(
        serial, text_substr="Offline", scrolls=2
    )
    time.sleep(1.5)
    # Lead with Ready status — scroll to top
    for _ in range(4):
        adb(serial, "shell", "input", "swipe", "540", "700", "540", "1500", "280", check=False)
        time.sleep(0.25)
    time.sleep(0.5)
    if ensure_app_foreground(serial):
        screencap(serial, raw / "04-downloads.png")

    # Normalize + write numbered fastlane + docs names
    mapping = {
        "01-map-hero.png": ("phone-01-map.png", "1.png"),
        "02-map-passage.png": ("phone-02-passage-map.png", "2.png"),
        "03-passage-detail.png": ("phone-03-passage.png", "3.png"),
        "04-downloads.png": ("phone-04-downloads.png", "4.png"),
        "05-tracks.png": ("phone-05-tracks.png", "5.png"),
        "06-safety.png": ("phone-06-disclaimer.png", "6.png"),
    }
    for src_name, (docs_name, fl_name) in mapping.items():
        src = raw / src_name
        if not src.exists():
            raise SystemExit(f"missing {src}")
        img = fit_phone(Image.open(src), anchor="bottom")
        docs_path = out_docs / f"{locale}-{docs_name}"
        img.save(docs_path, "PNG", optimize=True)
        fl_path = fastlane_dest / fl_name
        img.save(fl_path, "PNG", optimize=True)
        print(f"WROTE {docs_path.name} + {fl_path} {img.size}", flush=True)
    print("LOCALE_DONE", locale, flush=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--locale", required=True, choices=["en-US","de-DE","fr-FR","es-ES","da-DK","nl-NL","it-IT","pl-PL","sv-SE","nb-NO","pt-BR"])
    p.add_argument("--serial", required=True)
    p.add_argument("--apk", required=True)
    p.add_argument("--docs-out", required=True)
    p.add_argument("--fastlane-dir", required=True)
    args = p.parse_args()
    run(
        args.locale,
        args.serial,
        Path(args.apk),
        Path(args.docs_out),
        Path(args.fastlane_dir),
    )


if __name__ == "__main__":
    main()
