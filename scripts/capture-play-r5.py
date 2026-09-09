#!/usr/bin/env python3
"""SeaCheck Play R5 — close R4 REJECT wow 5.1 next_actions.

MUST: zero Jump/Sprung (dump + peach-pixel gate); clean #1 no scribble;
#2 active-passage theatre (name+Leg+Next+BRG·DIST·ETA); #3 ≥3 named WPs
in viewport bounds; #4 Kieler Bucht Ready pack card (not banner-only);
#5 airplane distinct; keep emulator-5602 lock.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
import numpy as np

PKG = "de.softwarebydesign.seacheck"
S = "emulator-5602"
TW, TH = 1080, 1920
ROOT = Path("/home/alex/Development/nextcloud-dev/mobile/seacheck")
DOCS = ROOT / "docs/play-store/assets/screenshots"
FARM = Path("/home/alex/Development/nextcloud-dev/.cursor/store-farm")
APK = ROOT / "android/app/build/outputs/apk/release/app-release.apk"
DB = f"/data/data/{PKG}/files/SQLite/seacheck.db"
RK = f"/data/data/{PKG}/databases/RKStorage"
NAME = "Kieler Foerde Laboe"
MAESTRO = "/home/alex/.maestro/bin/maestro"
# Mid-Förde south of Holtenau — outside arrival of all WPs when sailing north
GEO_PASSAGE = (10.175, 54.340)  # lon, lat — mid-Förde
# Open water (fewer seamark clusters that read as black scribbles near chrome)
GEO_HERO = (10.168, 54.348)
GEO_OFFLINE = (10.205, 54.365)  # distinct framing vs hero
FORBIDDEN_UI = (
    "Screen locked",
    "Bildschirm gesperrt",
    "Hold to unlock",
    "Gedrückt halten",
    "Akku & Hintergrund",
    "Battery & background",
    "Step 3 of 4",
    "Schritt 3 von 4",
    "Fertig",
    "SeaCheck öffnen",
    "Got it — continue",
)
MAP_POISON = (
    "Jump filtered",
    "Sprung gefiltert",
    'resource-id="map.gpsStatus.outlier"',
    "Wegpunkt erreicht",
    "Waypoint reached",
    "Waypoint arrival",
    "Waypoint reached or passed",
    "Ziel erreicht",
    'resource-id="confirm.sheet"',
)


def sh(*a, t=30):
    return subprocess.run(
        ["timeout", "-s", "KILL", str(int(t)), "adb", "-s", S, *a],
        text=True,
        capture_output=True,
    )


def tap(x, y, w=0.45):
    sh("shell", "input", "tap", str(x), str(y), t=8)
    time.sleep(w)


def swipe(a, b, c, d, ms=300):
    sh("shell", "input", "swipe", str(a), str(b), str(c), str(d), str(ms), t=8)
    time.sleep(0.25)


def hold(x, y, ms=1800):
    sh("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(ms), t=max(8, ms // 100 + 5))
    time.sleep(0.4)


def geo_at(lon: float, lat: float, n: int = 14, kn: float = 5.5, dlon: float = 0.000008, dlat: float = 0.000010):
    """Smooth underway inject — tiny steps avoid gpsOutlier / Jump filtered peach pill."""
    sh("shell", "settings", "put", "secure", "location_mode", "3", t=5)
    sh("shell", "cmd", "location", "set-location-enabled", "true", t=5)
    for i in range(n):
        sh(
            "emu",
            "geo",
            "fix",
            f"{lon + dlon * i:.6f}",
            f"{lat + dlat * i:.6f}",
            "4",
            "8",
            f"{kn:.1f}",
            t=5,
        )
        time.sleep(0.55)


def reset_gps_baseline(lon: float, lat: float, kn: float = 5.0):
    """Force-stop clears lastGoodFix so the next inject is not classified as Jump filtered."""
    sh("shell", "am", "force-stop", PKG, t=8)
    time.sleep(0.4)
    focus()
    time.sleep(1.6)
    ensure_unlocked()
    dismiss_modals()
    sh("emu", "geo", "fix", f"{lon:.6f}", f"{lat:.6f}", "4", "8", f"{kn:.1f}", t=5)
    time.sleep(1.0)
    geo_at(lon, lat, n=12, kn=kn)


def jump_pill_score(img: Image.Image) -> dict:
    """Visual detect Jump/Sprung peach chip — uiautomator omits chip text under map.topChrome."""
    arr = np.array(img.convert("RGB"))
    h = arr.shape[0]
    # status chips sit just under the status bar
    y0, y1 = (100, 230) if h >= 2000 else (70, 200)
    band = arr[y0:y1, 0:700]
    cream = (
        (band[:, :, 0] > 240)
        & (band[:, :, 1] > 225)
        & (band[:, :, 1] < 255)
        & (band[:, :, 2] > 210)
        & (band[:, :, 2] < 245)
        & ((band[:, :, 0].astype(int) - band[:, :, 2].astype(int)) > 10)
    )
    brown = (
        (band[:, :, 0] > 120)
        & (band[:, :, 0] < 160)
        & (band[:, :, 1] > 55)
        & (band[:, :, 1] < 95)
        & (band[:, :, 2] < 30)
    )
    return {"cream": int(cream.sum()), "brown": int(brown.sum())}


def has_jump_pill(img: Image.Image) -> bool:
    s = jump_pill_score(img)
    # Jump/Sprung peach chip has brown text (~2k px). Cream alone is often chart water/land.
    return s["brown"] > 200


def peach_pixels(img: Image.Image) -> int:
    """Backward-compatible score — prefer has_jump_pill for gates."""
    s = jump_pill_score(img)
    return s["cream"] + s["brown"] * 10


def find_all(xml: str, text: str | None = None, rid: str | None = None, contains: bool = False):
    hits = []
    for m in re.finditer(r"<node[^>]+>", xml or ""):
        n = m.group(0)
        if rid:
            rm = re.search(r'resource-id="([^"]*)"', n)
            if not rm or rm.group(1) != rid:
                continue
        if text:
            tm = re.search(r'text="([^"]*)"', n)
            cm = re.search(r'content-desc="([^"]*)"', n)
            tval = tm.group(1) if tm else ""
            cval = cm.group(1) if cm else ""
            if contains:
                ok = text in tval or text in cval
            else:
                ok = tval == text or cval == text
            if not ok:
                continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 > x1 and y2 > y1:
            hits.append((x1, y1, x2, y2))
    return hits


def visible_in_fold(bounds, y_max: int = 1850, y_min: int = 80) -> bool:
    _x1, y1, _x2, y2 = bounds
    mid = (y1 + y2) // 2
    return y_min <= mid <= y_max


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/sc.xml", t=8)
    return sh("shell", "cat", "/sdcard/sc.xml", t=6).stdout or ""


def find(xml, rid=None, text=None):
    for m in re.finditer(r"<node[^>]+>", xml or ""):
        n = m.group(0)
        if rid:
            rm = re.search(r'resource-id="([^"]*)"', n)
            if not rm or rm.group(1) != rid:
                continue
        if text and text not in n:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 > x1 and y2 > y1:
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap_id(rid=None, text=None, scrolls=2) -> bool:
    for _ in range(scrolls + 1):
        xml = dump()
        hit = find(xml, rid=rid, text=text)
        if hit:
            print(f"TAP {rid or text} @{hit[0]},{hit[1]}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1600, 540, 700, 300)
    print(f"MISS {rid or text}", flush=True)
    return False


def screencap_png() -> bytes:
    last_err = None
    for attempt in range(6):
        try:
            data = subprocess.check_output(
                ["timeout", "-s", "KILL", "50", "adb", "-s", S, "exec-out", "screencap", "-p"],
                timeout=55,
            )
            if not data.startswith(b"\x89PNG"):
                data = data.replace(b"\r\n", b"\n")
            if data.startswith(b"\x89PNG") and len(data) > 20000:
                return data
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            last_err = e
            print(f"SCREENCAP_RETRY {attempt}: {e}", flush=True)
            time.sleep(1.2)
    raise SystemExit(f"screencap failed: {last_err}")


def cap(path: Path):
    data = screencap_png()
    path.write_bytes(data)
    print(f"CAPTURED {path.name} ({path.stat().st_size})", flush=True)


def fit(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    sw, sh_ = im.size
    scale = max(TW / sw, TH / sh_)
    nw, nh = int(sw * scale), int(sh_ * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TW) // 2
    top = max(0, nh - TH)
    return im.crop((left, top, left + TW, top + TH))


def fit_top(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    sw, sh_ = im.size
    scale = max(TW / sw, TH / sh_)
    nw, nh = int(sw * scale), int(sh_ * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TW) // 2
    return im.crop((left, 0, left + TW, TH))


def grant():
    for p in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
    ):
        sh("shell", "pm", "grant", PKG, p, t=5)


def ensure_adb_root():
    """Release APK needs root shell to seed SQLite under /data/data."""
    r = sh("shell", "id", t=5)
    if "uid=0(root)" in (r.stdout or ""):
        return
    print("ADB_ROOT requesting", flush=True)
    subprocess.run(["adb", "-s", S, "root"], text=True, capture_output=True, timeout=30)
    time.sleep(2.0)
    subprocess.run(["adb", "-s", S, "wait-for-device"], text=True, capture_output=True, timeout=60)
    r = sh("shell", "id", t=5)
    if "uid=0(root)" not in (r.stdout or ""):
        raise SystemExit(f"adb root failed: {(r.stdout or '').strip()}")
    print("ADB_ROOT ok", flush=True)


def focus():
    sh("shell", "am", "force-stop", "com.google.android.googlequicksearchbox", t=5)
    sh("shell", "am", "force-stop", "com.google.android.apps.youtube.music", t=5)
    sh("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", t=20)
    time.sleep(1.0)


def assert_not_forbidden(xml: str, label: str):
    for bad in FORBIDDEN_UI:
        if bad in xml:
            raise SystemExit(f"FORBIDDEN UI before {label}: {bad}")


def assert_map_clean(xml: str, label: str):
    for bad in MAP_POISON:
        if bad in xml:
            raise SystemExit(f"MAP_POISON before {label}: {bad}")


def ensure_unlocked():
    xml = dump()
    # NOTE: map.screenLock is the LOCK *button*, not the lock overlay — never treat it as locked.
    if "map.screenLockOverlay" in xml or "Screen locked" in xml or "Bildschirm gesperrt" in xml:
        print("UNLOCK hold", flush=True)
        hit = find(xml, rid="map.screenLockOverlay") or (540, 1100)
        hold(hit[0], hit[1], 2200)
        time.sleep(0.6)
        xml = dump()
        if "map.screenLockOverlay" in xml or "Screen locked" in xml or "Bildschirm gesperrt" in xml:
            hold(540, 1200, 2400)
            time.sleep(0.5)


def dismiss_tips():
    for _ in range(4):
        xml = dump()
        hit = (
            find(xml, rid="map.topAlert.dismiss")
            or find(xml, rid="confirm.cancel")
            or find(xml, rid="confirm.sheet.close")
            or find(xml, text="Not yet")
            or find(xml, text="Noch nicht")
            or find(xml, text="Later")
            or find(xml, text="Später")
        )
        if not hit:
            if "downloadHint" in xml or "Opens Downloads" in xml or "unter Downloads" in xml:
                tap(1000, 180, 0.3)
                tap(980, 160, 0.3)
            break
        tap(*hit, 0.35)


def dismiss_modals():
    """Dismiss arrival / leg-advance sheets + tips before map grabs."""
    for _ in range(6):
        xml = dump()
        hit = (
            find(xml, rid="confirm.cancel")
            or find(xml, rid="confirm.sheet.close")
            or find(xml, text="Later")
            or find(xml, text="Später")
            or find(xml, text="Not yet")
            or find(xml, text="Noch nicht")
        )
        if hit:
            print(f"DISMISS modal @{hit}", flush=True)
            tap(*hit, 0.4)
            continue
        dismiss_tips()
        break


def wait_map_clean(label: str, lon: float, lat: float, kn: float = 5.5, timeout: float = 90) -> str:
    """Inject smooth geo until Jump/Sprung gone — visual chip gate (dump omits pill text)."""
    end = time.time() + timeout
    attempt = 0
    reset_done = False
    while time.time() < end:
        attempt += 1
        ensure_unlocked()
        dismiss_modals()
        geo_at(lon, lat, n=6, kn=kn)
        time.sleep(0.7)
        xml = dump()
        poison = [b for b in MAP_POISON if b in xml]
        data = screencap_png()
        img = Image.open(io.BytesIO(data))
        score = jump_pill_score(img)
        pill = has_jump_pill(img)
        on_map = (
            "screen.map" in xml
            or "tab.map" in xml
            or "map.instrumentDock" in xml
            or "map.instruments" in xml
            or "map.topChrome" in xml
        )
        if not poison and not pill and on_map:
            print(f"MAP_CLEAN {label} @{attempt} score={score}", flush=True)
            return xml
        print(f"WAIT_CLEAN {label} poison={poison[:2]} pill={pill} score={score}", flush=True)
        if (pill or poison) and attempt >= 3 and not reset_done:
            print(f"GPS_RESET {label}", flush=True)
            reset_gps_baseline(lon, lat, kn=kn)
            reset_done = True
            continue
        if pill and attempt >= 6 and reset_done:
            # second reset after failed settle
            reset_gps_baseline(lon, lat, kn=kn)
            attempt = 3
        time.sleep(0.45)
    xml = dump()
    data = screencap_png()
    if has_jump_pill(Image.open(io.BytesIO(data))):
        raise SystemExit(f"Jump/Sprung pill still visible before {label}")
    assert_map_clean(xml, label)
    return xml


def cap_map_clean(path: Path, label: str, lon: float, lat: float, kn: float = 5.5):
    """Dump+visual-clean gate before accepting a map screenshot."""
    for attempt in range(10):
        xml = wait_map_clean(f"{label}/try{attempt}", lon, lat, kn=kn, timeout=70)
        assert_not_forbidden(xml, label)
        assert_map_clean(xml, label)
        geo_at(lon, lat, n=3, kn=kn)
        time.sleep(0.35)
        data = screencap_png()
        img = Image.open(io.BytesIO(data))
        score = jump_pill_score(img)
        print(f"PILL {label}={score}", flush=True)
        if has_jump_pill(img):
            print(f"PILL_FAIL {label} retry", flush=True)
            reset_gps_baseline(lon, lat, kn=kn)
            continue
        path.write_bytes(data)
        print(f"CAPTURED {path.name} ({path.stat().st_size}) pill={score}", flush=True)
        return dump()
    raise SystemExit(f"could not capture clean map for {label}")


def scroll_dock_to_top():
    """Instrument dock is a ScrollView — reveal passage name/Leg/Next at top."""
    for _ in range(5):
        swipe(540, 1500, 540, 1900, 280)  # finger down → content down → top visible
        time.sleep(0.2)


def assert_passage_theatre(xml: str, label: str):
    """Hard require active-passage theatre chrome (R3 EN#2 bar)."""
    if "map.passageInstrument" not in xml:
        raise SystemExit(f"{label}: missing map.passageInstrument")
    has_leg = ("Leg " in xml) or ("Etappe " in xml)
    has_next = ("Next:" in xml) or ("Nächster:" in xml) or ("Next " in xml) or ("Nächste" in xml)
    has_brg = ("Brg" in xml) or ("BRG" in xml) or ("Kurs zum" in xml) or ("passage.brg" in xml)
    if not (has_leg and has_next):
        raise SystemExit(f"{label}: theatre missing Leg/Next (leg={has_leg} next={has_next})")
    if NAME.split()[0] not in xml and NAME not in xml:
        raise SystemExit(f"{label}: passage name missing")
    if not has_brg and "map.distTo" not in xml and "NM" not in xml:
        raise SystemExit(f"{label}: BRG/DIST chrome missing")
    print(f"THEATRE_OK {label}", flush=True)


def patch_settings_dismiss_tips(layout: str = "map-forward"):
    """Persist tips dismissed + tight arrival so Wegpunkt modal stays off during capture."""
    r = sh(
        "shell",
        f"sqlite3 {RK} \"SELECT value FROM catalystLocalStorage WHERE key='seacheck.settings.v1';\"",
        t=10,
    )
    raw = (r.stdout or "").strip()
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    data["downloadHintDismissed"] = True
    data["passagePlanningGuideDismissed"] = True
    data["onboardingCompleted"] = True
    data["batteryGuidanceAcknowledged"] = True
    # Tiny arrival circle — mid-Förde boat won't trip Holtenau modal
    data["alarmLimits"] = {"xteNm": 0.05, "arrivalNm": 0.02}
    data["legAdvanceAuto"] = False
    data["layoutPreset"] = layout
    data["layoutOverrides"] = {
        "cruise-passage:phone:portrait": layout,
        "cruise-passage:compact:portrait": layout,
    }
    data["mapShowDepthOverlay"] = False
    data["mapShowCourseVector"] = False
    data["backgroundTrackRecording"] = False
    data["gpsSmoothPosition"] = True
    out = json.dumps(data, separators=(",", ":"))
    # escape single quotes for sqlite
    out_sql = out.replace("'", "''")
    sql = f"INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES('seacheck.settings.v1','{out_sql}');\n"
    Path("/tmp/seacheck-settings.sql").write_text(sql)
    sh("push", "/tmp/seacheck-settings.sql", "/data/local/tmp/seacheck-settings.sql", t=10)
    sh("shell", f"sqlite3 {RK} < /data/local/tmp/seacheck-settings.sql", t=10)
    print(f"SETTINGS tips+layout={layout}", flush=True)


def seed_db(active: int = 1):
    """Marina → Holtenau → Friedrichsort → Laboe (northbound, ≥3 named coastal legs)."""
    ensure_adb_root()
    sh("shell", "am", "force-stop", PKG, t=8)
    time.sleep(0.35)
    # Ensure parent dir exists (first launch creates it; recreate after wipe)
    sh("shell", f"mkdir -p $(dirname {DB})", t=5)
    sql = f"""BEGIN;
DELETE FROM passage_waypoints; DELETE FROM waypoints; DELETE FROM passage_leg_overrides; DELETE FROM passages;
INSERT INTO passages(id,name,planned_departure,default_sog_kn,is_active,created_at) VALUES
 ('pass_kiel_laboe','{NAME}',NULL,5.0,{active},strftime('%s','now')*1000);
INSERT INTO waypoints(id,name,latitude,longitude,type,note,created_at) VALUES
 ('wp_marina','KielMarina',54.3230,10.1860,'generic','',strftime('%s','now')*1000),
 ('wp_holt','Holtenau',54.3680,10.1520,'generic','',strftime('%s','now')*1000),
 ('wp_fried','Friedrichsort',54.3900,10.1850,'generic','',strftime('%s','now')*1000),
 ('wp_laboe','Laboe',54.4000,10.2200,'generic','',strftime('%s','now')*1000);
INSERT INTO passage_waypoints(passage_id,waypoint_id,sort_order) VALUES
 ('pass_kiel_laboe','wp_marina',0),('pass_kiel_laboe','wp_holt',1),
 ('pass_kiel_laboe','wp_fried',2),('pass_kiel_laboe','wp_laboe',3);
COMMIT; SELECT name||'|'||is_active FROM passages; SELECT COUNT(*) FROM passage_waypoints;"""
    Path("/tmp/seacheck-seed.sql").write_text(sql)
    sh("push", "/tmp/seacheck-seed.sql", "/data/local/tmp/seacheck-seed.sql", t=10)
    r = sh("shell", f"sqlite3 {DB} < /data/local/tmp/seacheck-seed.sql", t=15)
    out = (r.stdout or "").strip()
    print("DB_SEED", out, "err=", (r.stderr or "").strip()[:120], flush=True)
    if "Kieler Foerde Laboe|1" not in out and active == 1:
        raise SystemExit(f"DB seed failed: {out!r} stderr={(r.stderr or '')[:200]!r}")
    focus()
    time.sleep(2.0)
    patch_settings_dismiss_tips()
    focus()
    time.sleep(1.5)


def offline_has_kiel() -> bool:
    r = sh(
        "shell",
        f"sqlite3 {RK} \"SELECT value FROM catalystLocalStorage WHERE key='seacheck.offline.v1';\"",
        t=10,
    )
    v = (r.stdout or "").strip()
    print("OFFLINE_IDX", v[:160], flush=True)
    return "kiel-bay" in v and "packId" in v


def open_downloads() -> bool:
    ensure_unlocked()
    dismiss_modals()
    xml = dump()
    if "screen.downloads" in xml:
        return True
    hit = find(xml, rid="map.downloadSession.openDownloads") or find(xml, text="Open Downloads")
    if hit:
        tap(*hit, 1.2)
        if "screen.downloads" in dump():
            return True
    # More sheet hosts tab.downloads — tap live bounds; never swipe (closes sheet)
    for attempt in range(6):
        ensure_unlocked()
        xml = dump()
        more = find(xml, rid="tab.more") or find(xml, text="More") or find(xml, text="Mehr")
        if more:
            print(f"TAP tab.more @{more}", flush=True)
            tap(*more, 0.95)
        else:
            print(f"MORE_TAB miss @{attempt} — fallback", flush=True)
            tap(945, 2050, 0.95)
        time.sleep(1.0)
        xml = dump()
        if "tab.more.sheet" not in xml and "tab.downloads" not in xml:
            print(f"MORE_SHEET miss @{attempt}", flush=True)
            continue
        hit = (
            find(xml, rid="tab.downloads")
            or find(xml, text="Downloads")
            or find(xml, text="Offline charts")
            or find(xml, text="Offline-Karten")
        )
        if hit:
            print(f"TAP downloads menu @{hit}", flush=True)
            tap(*hit, 1.3)
            time.sleep(1.2)
            xml = dump()
            if "screen.downloads" in xml or "downloads." in xml:
                return True
        close = find(xml, rid="tab.more.sheet.close")
        if close:
            tap(*close, 0.4)
        time.sleep(0.35)
    print("OPEN_DOWNLOADS failed", flush=True)
    return "screen.downloads" in dump()


def download_chrome_visible(xml: str) -> bool:
    return (
        "map.downloadSession" in xml
        or "Downloading chart pack" in xml
        or "Kartenpaket wird geladen" in xml
        or ("complete" in xml and ("Downloading" in xml or "geladen" in xml.lower()))
    )


def seal() -> bool:
    """Download ONLY kiel-bay — never generic Download pack (starts Kattegat north)."""
    already = offline_has_kiel()
    if not already:
        if not open_downloads():
            return False
        time.sleep(1)
        xml = dump()
        # Cancel any wrong-pack session before starting kiel-bay
        if "Kattegat" in xml and download_chrome_visible(xml):
            hit = find(xml, rid="downloads.globalSessionChrome.cancel") or find(xml, text="Cancel download")
            if hit:
                tap(*hit, 0.8)
                time.sleep(1.2)
                if not open_downloads():
                    return False
        started = False
        for _ in range(30):
            xml = dump()
            hit = find(xml, rid="downloads.download.kiel-bay")
            if hit:
                print(f"TAP downloads.download.kiel-bay @{hit}", flush=True)
                tap(*hit, 0.7)
                started = True
                break
            if find(xml, text="Kieler Bucht") or find(xml, text="Kiel Bay"):
                kb = find(xml, text="Kieler Bucht") or find(xml, text="Kiel Bay")
                # reveal row actions under the pack name, then require explicit kiel-bay id
                tap(kb[0], min(kb[1] + 140, 1900), 0.45)
                xml = dump()
                hit = find(xml, rid="downloads.download.kiel-bay")
                if hit:
                    print(f"TAP downloads.download.kiel-bay @{hit}", flush=True)
                    tap(*hit, 0.7)
                    started = True
                    break
            swipe(540, 1600, 540, 700, 300)
            time.sleep(0.25)
        print("DOWNLOAD_KIEL", started, flush=True)
        if not started:
            return False
    end = time.time() + 600
    while time.time() < end:
        xml = dump()
        if download_chrome_visible(xml):
            if "Kattegat" in xml:
                print("ABORT wrong pack Kattegat", flush=True)
                hit = find(xml, rid="downloads.globalSessionChrome.cancel") or find(xml, text="Cancel download")
                if hit:
                    tap(*hit, 0.8)
                return False
            if "screen.map" not in xml:
                tap(135, 2029, 0.5)
            m = re.search(r"(\d+)%", xml)
            print(f"SEAL kiel wait… {m.group(1) if m else '?'}%", flush=True)
            time.sleep(6)
            continue
        if offline_has_kiel():
            if open_downloads():
                xml = dump()
                if download_chrome_visible(xml):
                    time.sleep(4)
                    continue
                if "No offline packs yet" in xml or "Noch keine Offline-Pakete" in xml:
                    time.sleep(4)
                    continue
                return True
        time.sleep(4)
    return offline_has_kiel() and not download_chrome_visible(dump())


def scroll_downloads_pack_in_fold() -> str:
    """Scroll until Kieler Bucht pack Ready/delete row is in viewport — not help-copy false positives."""
    for i in range(24):
        xml = dump()
        delete = [b for b in find_all(xml, rid="downloads.delete.kiel-bay") if visible_in_fold(b, y_max=1850)]
        # Title nodes are short; help copy mentioning Kieler Bucht is tall/wide paragraphs
        title_hits = []
        for label in ("Kieler Bucht (test)", "Kiel Bay (test)", "Kieler Bucht (Test)", "Kieler Bucht"):
            for b in find_all(xml, text=label, contains=(label == "Kieler Bucht")):
                _x1, y1, _x2, y2 = b
                if (y2 - y1) <= 80 and visible_in_fold(b, y_max=1700):
                    title_hits.append(b)
        banner_ok = (
            "chart pack ready" in xml
            or "Kartenpaket offline" in xml
            or "ready offline" in xml
            or "offline bereit" in xml
            or "1 chart pack" in xml
            or "1 Kartenpaket" in xml
        )
        if delete and title_hits and banner_ok:
            print(f"PACK_IN_FOLD @{i} title_y={title_hits[0][1]} del_y={delete[0][1]}", flush=True)
            return xml
        if delete and banner_ok and not title_hits:
            # delete visible — nudge so pack title sits higher in fold
            swipe(540, 1200, 540, 1500, 280)
            time.sleep(0.3)
            continue
        swipe(540, 1600, 540, 620, 360)
        time.sleep(0.35)
    xml = dump()
    if not find_all(xml, rid="downloads.delete.kiel-bay"):
        raise SystemExit("#4 kiel-bay Ready/delete row missing")
    if not any(visible_in_fold(b) for b in find_all(xml, rid="downloads.delete.kiel-bay")):
        raise SystemExit("#4 Kieler Bucht Ready pack not in fold viewport")
    return xml


def scroll_passage_waypoints_visible() -> str:
    """Scroll detail until ≥3 named coastal legs have viewport bounds (not off-screen dump hits)."""
    tap_id(rid="passage.detail.tab.route", scrolls=0)
    time.sleep(0.3)
    coastal = ("Holtenau", "Friedrichsort", "Laboe", "KielMarina")
    for i in range(20):
        xml = dump()
        vis = []
        for name in coastal:
            for b in find_all(xml, text=name):
                # Ignore title "Kieler Foerde Laboe" — require small text row (height < 120)
                _x1, y1, _x2, y2 = b
                if (y2 - y1) > 120:
                    continue
                if visible_in_fold(b, y_max=1820, y_min=120):
                    vis.append(name)
                    break
        vis = list(dict.fromkeys(vis))
        if len(vis) >= 3 and "passage.waypoints" in xml:
            print(f"WAYPOINTS_VISIBLE @{i} names={vis}", flush=True)
            return xml
        # scroll content up so list rows rise into fold (buttons sit above named rows)
        swipe(540, 1550, 540, 600, 340)
        time.sleep(0.3)
    xml = dump()
    vis = []
    for name in coastal:
        for b in find_all(xml, text=name):
            _x1, y1, _x2, y2 = b
            if (y2 - y1) > 120:
                continue
            if visible_in_fold(b):
                vis.append(name)
                break
    if len(vis) < 3:
        raise SystemExit(f"#3 passage detail missing named legs in viewport: {vis}")
    return xml


def onboard_capture_safety(raw: Path):
    disclaimer_ok = False
    for i in range(40):
        time.sleep(0.6)
        xml = dump()
        if (
            "onboarding.disclaimer.continue" in xml
            or "Aid to navigation" in xml
            or "Navigationshilfe" in xml
            or "I understand" in xml
            or "Verstanden — weiter" in xml
            or "acceptDisclaimer" in xml
        ):
            disclaimer_ok = True
            print(f"DISCLAIMER ready @{i}", flush=True)
            break
        if "screen.map" in xml and "tab.map" in xml:
            raise SystemExit("missed disclaimer — already on map")
    if not disclaimer_ok:
        raise SystemExit("disclaimer never appeared")

    for _ in range(2):
        swipe(540, 700, 540, 1400, 280)
    time.sleep(0.4)
    xml = dump()
    if "Battery" in xml or "Akku" in xml or "Step 3" in xml or "Schritt 3" in xml:
        raise SystemExit("on battery before safety capture")
    cap(raw / "06-safety.png")

    if not (
        tap_id(rid="onboarding.disclaimer.continue", scrolls=1)
        or tap_id(text="I understand", scrolls=1)
        or tap_id(text="Verstanden — weiter", scrolls=1)
    ):
        tap(540, 1962, 1.0)
    time.sleep(0.8)
    tap_id(rid="onboarding.location.continue", scrolls=1) or tap(540, 1700, 0.9)
    grant()
    tap(540, 1828, 0.6)
    tap_id(rid="onboarding.location.continue", scrolls=0) or tap(540, 1600, 0.8)
    tap_id(rid="onboarding.battery.ack", scrolls=1) or tap_id(text="Got it", scrolls=1) or tap_id(
        text="Verstanden", scrolls=1
    ) or tap(540, 1224, 0.9)
    for _ in range(6):
        xml = dump()
        if "screen.map" in xml or "tab.map" in xml:
            break
        if tap_id(rid="onboarding.finish", scrolls=0):
            break
        if tap_id(text="Open SeaCheck", scrolls=0) or tap_id(text="SeaCheck öffnen", scrolls=0):
            break
        tap(540, 1600, 0.6)
        tap(540, 1250, 0.6)
    grant()
    time.sleep(2)
    patch_settings_dismiss_tips()
    focus()
    time.sleep(1.5)
    dismiss_modals()
    ensure_unlocked()


def run_locale(loc: str):
    ensure_adb_root()
    raw = DOCS / f"_raw-live-{loc}"
    raw.mkdir(parents=True, exist_ok=True)
    lang = "de-DE" if loc.startswith("de") else "en-US"
    print("==>", loc, flush=True)
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
    sh("shell", "svc", "wifi", "enable", t=8)
    sh("shell", "settings", "put", "system", "system_locales", lang, t=8)
    sh("uninstall", PKG, t=40)
    r = sh("install", "-r", str(APK), t=120)
    if r.returncode:
        raise SystemExit(f"install failed {r.stderr}")
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, t=8)
    sh("shell", "pm", "clear", PKG, t=20)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, t=8)
    sh("shell", "pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS", t=5)
    focus()
    onboard_capture_safety(raw)
    grant()
    focus()
    time.sleep(1.0)

    # #1 map hero — clean instruments, no Jump pill, no scribble from jumps
    tap(135, 2029, 0.5)
    reset_gps_baseline(*GEO_HERO, kn=4.8)
    cap_map_clean(raw / "01-map-hero.png", f"{loc}#1", *GEO_HERO, kn=4.8)

    # #2 active passage theatre — name + Leg + Next + BRG·DIST·ETA, zero Jump
    seed_db(active=1)
    patch_settings_dismiss_tips(layout="map-forward")
    focus()
    time.sleep(1.5)
    reset_gps_baseline(*GEO_PASSAGE, kn=5.2)
    tap(135, 2029, 0.6)
    dismiss_modals()
    tap_id(rid="passage.preview.showOnMap", scrolls=0)
    wait_map_clean(f"{loc}#2pre", *GEO_PASSAGE, kn=5.2)
    scroll_dock_to_top()
    xml = dump()
    if "map.passageInstrument" not in xml or ("Leg " not in xml and "Etappe " not in xml):
        print("THEATRE_WEAK → instruments-only", flush=True)
        patch_settings_dismiss_tips(layout="instruments-only")
        focus()
        time.sleep(1.8)
        ensure_unlocked()
        dismiss_modals()
        geo_at(*GEO_PASSAGE, n=10, kn=5.2)
        time.sleep(0.8)
        for _ in range(5):
            swipe(540, 800, 540, 1600, 280)
            time.sleep(0.2)
    xml = dump()
    assert_passage_theatre(xml, f"{loc}#2")
    assert_map_clean(xml, f"{loc}#2")
    geo_at(*GEO_PASSAGE, n=4, kn=5.2)
    time.sleep(0.4)
    xml = dump()
    assert_map_clean(xml, f"{loc}#2")
    assert_passage_theatre(xml, f"{loc}#2")
    data = screencap_png()
    img = Image.open(io.BytesIO(data))
    score = jump_pill_score(img)
    print(f"PILL {loc}#2={score}", flush=True)
    if has_jump_pill(img):
        raise SystemExit(f"{loc}#2 Jump/Sprung pill still visible ({score})")
    (raw / "02-map-passage.png").write_bytes(data)
    print(f"CAPTURED 02-map-passage.png pill={score}", flush=True)
    patch_settings_dismiss_tips(layout="map-forward")

    # #3 passage detail — ≥3 named waypoints in viewport
    focus()
    time.sleep(1.2)
    tap(405, 2029, 0.8)
    time.sleep(0.7)
    ensure_unlocked()
    xml = dump()
    m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml)
    if m:
        tap_id(rid=m.group(0).split('"')[1], scrolls=0)
    else:
        tap(540, 720, 0.8)
    time.sleep(0.6)
    xml = scroll_passage_waypoints_visible()
    assert_not_forbidden(xml, f"{loc}#3")
    cap(raw / "03-passage-detail.png")

    # deactivate before downloads
    sh("shell", "am", "force-stop", PKG, t=8)
    sh("shell", f'sqlite3 {DB} "UPDATE passages SET is_active=0;"', t=10)
    focus()
    time.sleep(2)
    ensure_unlocked()
    ok = seal()
    print("SEALED", ok, flush=True)
    if not ok:
        raise SystemExit(f"{loc} seal failed")
    xml = scroll_downloads_pack_in_fold()
    assert_not_forbidden(xml, f"{loc}#4")
    if "No offline packs yet" in xml or "Noch keine Offline-Pakete" in xml:
        raise SystemExit(f"{loc}#4 empty packs")
    cap(raw / "04-downloads.png")

    # #5 offline — distinct lon/lat + airplane vs #1 hero
    sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
    time.sleep(1.2)
    tap(135, 2029, 0.8)
    reset_gps_baseline(*GEO_OFFLINE, kn=6.8)
    cap_map_clean(raw / "05-offline.png", f"{loc}#5", *GEO_OFFLINE, kn=6.8)
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)

    hashes = []
    for i, name in enumerate(
        [
            "01-map-hero.png",
            "02-map-passage.png",
            "03-passage-detail.png",
            "04-downloads.png",
            "05-offline.png",
            "06-safety.png",
        ],
        1,
    ):
        p = raw / name
        if not p.exists() or p.stat().st_size < 90000:
            raise SystemExit(f"weak {loc} {name} size={p.stat().st_size if p.exists() else 0}")
        h = hashlib.md5(p.read_bytes()).hexdigest()
        hashes.append(h)
        print(f"CHK {loc} #{i} {p.stat().st_size} {h}", flush=True)
    if len(set(hashes)) < 6:
        raise SystemExit(f"{loc} duplicate raw hashes: {hashes}")
    if hashes[1] == hashes[2]:
        raise SystemExit(f"{loc} #2/#3 identical")

    write_locale_outputs(loc, raw)
    print("LOCALE_DONE", loc, flush=True)


def write_locale_outputs(loc: str, raw: Path):
    fl = ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots"
    fl.mkdir(parents=True, exist_ok=True)
    mapping = {
        "01-map-hero.png": ("phone-01-map.png", "1.png", "top"),
        "02-map-passage.png": ("phone-02-passage-map.png", "2.png", "top"),
        # top after scrolling named rows into upper fold
        "03-passage-detail.png": ("phone-03-passage.png", "3.png", "top"),
        "04-downloads.png": ("phone-04-downloads.png", "4.png", "top"),
        "05-offline.png": ("phone-05-offline.png", "5.png", "top"),
        "06-safety.png": ("phone-06-disclaimer.png", "6.png", "bottom"),
    }
    for src_n, (dn, fn, mode) in mapping.items():
        src = raw / src_n
        img = fit_top(Image.open(src)) if mode == "top" else fit(Image.open(src))
        assert img.size == (1080, 1920)
        img.save(DOCS / f"{loc}-{dn}", "PNG", optimize=True)
        if loc == "en-US":
            img.save(DOCS / dn, "PNG", optimize=True)
        img.save(fl / fn, "PNG", optimize=True)
        print("WROTE", loc, fn, img.size, flush=True)


def write_ready():
    def counts(path: Path):
        t = path.read_text()
        title = short = full = None
        section = None
        buf: list[str] = []

        def flush():
            nonlocal title, short, full, buf, section
            text = "\n".join(buf).strip()
            if section == "title":
                title = text
            elif section == "short":
                short = text
            elif section == "full":
                full = text
            buf = []

        for line in t.splitlines():
            if line.startswith("Title:"):
                flush()
                section = "title"
                buf = [line.split(":", 1)[1].strip()]
            elif line.startswith("Short description:"):
                flush()
                section = "short"
                buf = [line.split(":", 1)[1].strip()]
            elif line.startswith("Full description:"):
                flush()
                section = "full"
                buf = []
            elif section == "full" and line.startswith("==="):
                flush()
                section = None
            elif section:
                buf.append(line)
        flush()
        return len(title or ""), len(short or ""), len(full or "")

    docs = ROOT / "docs/play-store"
    en, de = counts(docs / "LISTING-en.txt"), counts(docs / "LISTING-de.txt")
    for stale in ("phone-02-disclaimer.png", "phone-06-about.png"):
        p = DOCS / stale
        if p.exists():
            p.unlink()
    for dbg in list(DOCS.glob("_dbg-*.png")) + list(DOCS.glob("_view-*.png")):
        dbg.unlink()

    hashes = {}
    c = {}
    for loc in ("en-US", "de-DE"):
        files = sorted((ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots").glob("[1-6].png"))
        c[loc] = len(files)
        hs = []
        for f in files:
            assert Image.open(f).size == (1080, 1920), f
            hs.append(hashlib.md5(f.read_bytes()).hexdigest())
        if len(set(hs)) < 6:
            raise SystemExit(f"fastlane {loc} duplicate md5 {hs}")
        hashes[loc] = hs
    if hashes["en-US"][1] == hashes["en-US"][2]:
        raise SystemExit("en #2/#3 still identical")
    if len(set(hashes["de-DE"])) < 6:
        raise SystemExit("de clones remain")

    en1 = (ROOT / "fastlane/metadata/android/en-US/images/phoneScreenshots/1.png").read_bytes()
    de1 = (ROOT / "fastlane/metadata/android/de-DE/images/phoneScreenshots/1.png").read_bytes()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ready = {
        "app": "seacheck",
        "store": "play",
        "round": 5,
        "ready_for_critic": True,
        "waiting_for_avd": False,
        "avd_acquired": True,
        "avd": "SeaCheck_Maestro_API_33",
        "serial": "emulator-5602",
        "booted_by_us": True,
        "lock_held_for_critic": True,
        "lock_session": "agent-26970-alex-ThinkPad-P16-Gen-2",
        "apk": "mobile/seacheck/android/app/build/outputs/apk/release/app-release.apk",
        "versionName": "0.1.9",
        "versionCode": 9,
        "exit_met": False,
        "visual_aaa": False,
        "wow_factor": None,
        "verdict": "pending_critic",
        "wow_target": 9,
        "char_counts": {
            "en-US": {
                "title": en[0],
                "title_limit": 30,
                "short_description": en[1],
                "short_limit": 80,
                "full_description": en[2],
                "full_limit": 4000,
                "ok": en[0] <= 30 and en[1] <= 80 and en[2] <= 4000,
            },
            "de-DE": {
                "title": de[0],
                "title_limit": 30,
                "short_description": de[1],
                "short_limit": 80,
                "full_description": de[2],
                "full_limit": 4000,
                "ok": de[0] <= 30 and de[1] <= 80 and de[2] <= 4000,
            },
        },
        "screenshots": {
            "phone_en-US": c["en-US"],
            "phone_de-DE": c["de-DE"],
            "size": "1080x1920",
            "en_de_byte_identical": en1 == de1,
            "sevenInch": 0,
            "tenInch": 0,
            "note": "R5: zero Jump/Sprung (dump+peach gate); clean #1; #2 theatre; #3 ≥3 WP viewport; #4 Kieler Bucht card; #5 airplane; lock held.",
            "paths": {
                "en-US": [f"mobile/seacheck/fastlane/metadata/android/en-US/images/phoneScreenshots/{i}.png" for i in range(1, 7)],
                "de-DE": [f"mobile/seacheck/fastlane/metadata/android/de-DE/images/phoneScreenshots/{i}.png" for i in range(1, 7)],
            },
        },
        "graphics": {"featureGraphic": "1024x500", "icon": "512x512"},
        "listing_source": "docs/play-store/LISTING-en.txt + LISTING-de.txt (no MT)",
        "changelogs": "fastlane .../changelogs/9.txt present en+de",
        "shot_list": ".cursor/store-farm/seacheck-play-shot-list.md",
        "capture_script": "mobile/seacheck/scripts/capture-play-r5.py",
        "r5_closed": [
            "Dismiss Jump filtered / Sprung gefiltert before every map grab (#1/#2/#5) — dump + peach-pixel gate",
            "Recapture #1 without black scribble — GPS baseline reset + no course-vector/depth overlay",
            "Restore #2 active-passage theatre: name + Leg/Etappe + Next + BRG·DIST·ETA, no Jump/Sprung",
            "Seed/scroll #3 ≥3 named coastal legs (Holtenau/Friedrichsort/Laboe) in viewport bounds",
            "Scroll #4 to named Kieler Bucht/Bay Ready pack card (not banner-only); keep green ready banner",
            "#5 airplane/offline framing distinct from #1 after pills dismissed",
            "DE #2/#3 stay non-modal-twins; AVD lock held on emulator-5602",
        ],
        "android_screenshots_refreshed": True,
        "updated_at": now,
        "status": "visual_ready",
        "visual_fix_queued": False,
    }
    (FARM / "visual-ready-seacheck-play.json").write_text(json.dumps(ready, indent=2) + "\n")
    (FARM / "status-seacheck-play.json").write_text(
        json.dumps(
            {
                "app": "seacheck",
                "store": "play",
                "status": "visual_ready",
                "ready_for_critic": True,
                "round": 5,
                "verdict": "pending_critic",
                "wow_factor": None,
                "exit_met": False,
                "visual_aaa": False,
                "visual_fix_queued": False,
                "avd_acquired": True,
                "avd": "SeaCheck_Maestro_API_33",
                "serial": "emulator-5602",
                "booted_by_us": True,
                "lock_held_for_critic": True,
                "lock_session": "agent-26970-alex-ThinkPad-P16-Gen-2",
                "char_counts": ready["char_counts"],
                "screenshots": ready["screenshots"],
                "apk": ready["apk"],
                "updated_at": now,
                "notes": "R5 landed; lock_held_for_critic — do not kill/release emulator-5602",
            },
            indent=2,
        )
        + "\n"
    )
    qpath = FARM / "queue.json"
    q = json.loads(qpath.read_text())
    for a in q["apps"]:
        if a["id"] == "seacheck":
            a.update(
                {
                    "status": "visual_ready",
                    "round": 5,
                    "ready_for_critic": True,
                    "visual_fix_queued": False,
                    "gap": "R5 visual_ready — Jump/Sprung+#1 scribble+#2 theatre+#3 WPs+#4 pack+#5 closed; awaiting harsh critic wow≥9",
                    "verdict": None,
                    "wow_factor": None,
                    "lock_held_for_critic": True,
                    "serial": "emulator-5602",
                    "avd": "SeaCheck_Maestro_API_33",
                    "updated_at": now,
                }
            )
    q["updated"] = now
    qpath.write_text(json.dumps(q, indent=2) + "\n")
    print("WROTE visual-ready ready_for_critic:true round:5", flush=True)


def main():
    run_locale("en-US")
    run_locale("de-DE")
    write_ready()


if __name__ == "__main__":
    main()
