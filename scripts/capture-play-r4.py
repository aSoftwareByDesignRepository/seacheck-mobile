#!/usr/bin/env python3
"""SeaCheck Play R4 — fix R3 REJECT wow 5.9.

MUST: zero Jump/Sprung pills; clean DE #2 passage HUD (no Wegpunkt modal);
DE/EN #3 ≥3 named Etappen; #4 Kieler Bucht pack card in fold; #5 distinct offline;
keep emulator-5602 lock.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

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
GEO_PASSAGE = (10.175, 54.340)  # lon, lat
GEO_HERO = (10.186, 54.323)
GEO_OFFLINE = (10.205, 54.355)  # distinct framing vs hero
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


def geo_at(lon: float, lat: float, n: int = 14, kn: float = 5.5, dlon: float = 0.000012, dlat: float = 0.000018):
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
        time.sleep(0.45)


def dump():
    sh("shell", "uiautomator", "dump", "--compressed", "/sdcard/sc.xml", t=6)
    return sh("shell", "cat", "/sdcard/sc.xml", t=4).stdout or ""


def find(xml, rid=None, text=None):
    for m in re.finditer(r"<node[^>]+>", xml or ""):
        n = m.group(0)
        if rid and f'resource-id="{rid}"' not in n:
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


def cap(path: Path):
    data = subprocess.check_output(
        ["timeout", "-s", "KILL", "40", "adb", "-s", S, "exec-out", "screencap", "-p"],
        timeout=45,
    )
    if not data.startswith(b"\x89PNG"):
        data = data.replace(b"\r\n", b"\n")
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
    if "map.screenLockOverlay" in xml or "Screen locked" in xml or "Bildschirm gesperrt" in xml:
        print("UNLOCK hold", flush=True)
        hit = find(xml, rid="map.screenLockOverlay") or (540, 1100)
        hold(hit[0], hit[1], 2000)
        time.sleep(0.5)
        xml = dump()
        if "map.screenLockOverlay" in xml:
            hold(540, 1200, 2200)


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


def wait_map_clean(label: str, lon: float, lat: float, kn: float = 5.5, timeout: float = 50) -> str:
    """Keep injecting smooth geo + dismissing sheets until Jump/Sprung/modals gone."""
    end = time.time() + timeout
    attempt = 0
    while time.time() < end:
        attempt += 1
        ensure_unlocked()
        dismiss_modals()
        geo_at(lon, lat, n=5, kn=kn)
        time.sleep(0.6)
        xml = dump()
        poison = [b for b in MAP_POISON if b in xml]
        if not poison and ("screen.map" in xml or "tab.map" in xml):
            print(f"MAP_CLEAN {label} @{attempt}", flush=True)
            return xml
        if poison:
            print(f"WAIT_CLEAN {label} still {poison[:2]}", flush=True)
        time.sleep(0.4)
    xml = dump()
    assert_map_clean(xml, label)
    return xml


def patch_settings_dismiss_tips():
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
    out = json.dumps(data, separators=(",", ":"))
    sql = f"INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES('seacheck.settings.v1','{out}');\n"
    Path("/tmp/seacheck-settings.sql").write_text(sql)
    sh("push", "/tmp/seacheck-settings.sql", "/data/local/tmp/seacheck-settings.sql", t=10)
    sh("shell", f"sqlite3 {RK} < /data/local/tmp/seacheck-settings.sql", t=10)
    print("SETTINGS tips dismissed + tight arrival", flush=True)


def seed_db(active: int = 1):
    """Marina → Holtenau → Friedrichsort → Laboe (northbound, ≥3 named coastal legs)."""
    sh("shell", "am", "force-stop", PKG, t=8)
    time.sleep(0.35)
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
COMMIT; SELECT name||'|'||is_active FROM passages;"""
    Path("/tmp/seacheck-seed.sql").write_text(sql)
    sh("push", "/tmp/seacheck-seed.sql", "/data/local/tmp/seacheck-seed.sql", t=10)
    r = sh("shell", f"sqlite3 {DB} < /data/local/tmp/seacheck-seed.sql", t=15)
    print("DB_SEED", (r.stdout or "").strip(), flush=True)
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
    flow = Path("/tmp/sc-r4-dl.yaml")
    flow.write_text(
        f"""appId: {PKG}
---
- launchApp
- runFlow:
    when:
      visible:
        id: "confirm.cancel"
    commands:
      - tapOn:
          id: "confirm.cancel"
- runFlow:
    when:
      visible:
        id: "map.screenLockOverlay"
    commands:
      - longPressOn:
          id: "map.screenLockOverlay"
- tapOn:
    id: "tab.more"
- tapOn:
    id: "tab.downloads"
"""
    )
    r = subprocess.run([MAESTRO, "--device", S, "test", str(flow)], text=True, capture_output=True, timeout=120)
    print("MAESTRO_DL", r.returncode, flush=True)
    time.sleep(1.0)
    xml = dump()
    if "screen.downloads" in xml or ("Offline" in xml and "downloads." in xml):
        return True
    tap(945, 2029, 1.6)
    for _ in range(8):
        xml = dump()
        hit = (
            find(xml, rid="tab.downloads")
            or find(xml, text="Offline charts")
            or find(xml, text="Offline-Karten")
        )
        if hit:
            tap(*hit, 1.3)
            if "screen.downloads" in dump():
                return True
        time.sleep(0.45)
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
    """Scroll until named Kieler Bucht/Bay pack + Ready row visible; sticky banner stays."""
    for i in range(12):
        xml = dump()
        named = "Kieler Bucht" in xml or "Kiel Bay" in xml
        ready = (
            "statusReady" in xml
            or "Ready" in xml
            or "Bereit" in xml
            or "ready offline" in xml
            or "offline bereit" in xml
            or "downloads.delete.kiel-bay" in xml
            or "chart pack ready" in xml
            or "Kartenpaket offline" in xml
        )
        if named and ready:
            print(f"PACK_IN_FOLD @{i}", flush=True)
            return xml
        # scroll content up (finger down→up) to reveal region packs below how-to
        swipe(540, 1500, 540, 700, 320)
        time.sleep(0.35)
    xml = dump()
    if "Kieler Bucht" not in xml and "Kiel Bay" not in xml:
        raise SystemExit("#4 Kieler Bucht/Bay pack not in fold")
    return xml


def scroll_passage_waypoints_visible() -> str:
    """Scroll detail until ≥3 named coastal legs are in UI dump."""
    # Ensure Route tab (not Map-only preview)
    tap_id(rid="passage.detail.tab.route", scrolls=0)
    time.sleep(0.3)
    for i in range(14):
        xml = dump()
        names = sum(1 for n in ("Holtenau", "Friedrichsort", "Laboe", "KielMarina", "Kiel Marina") if n in xml)
        if names >= 3 and "passage.waypoints" in xml:
            print(f"WAYPOINTS_VISIBLE @{i} names={names}", flush=True)
            return xml
        # scroll down to list (buttons sit above named rows)
        swipe(540, 1500, 540, 650, 320)
        time.sleep(0.3)
    xml = dump()
    names = [n for n in ("Holtenau", "Friedrichsort", "Laboe", "KielMarina", "Kiel Marina") if n in xml]
    if len(names) < 3:
        raise SystemExit(f"#3 passage detail missing named legs: {names}")
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

    # #1 map hero — clean instruments, no Jump pill
    tap(135, 2029, 0.5)
    xml = wait_map_clean(f"{loc}#1", *GEO_HERO, kn=4.8)
    assert_not_forbidden(xml, f"{loc}#1")
    assert_map_clean(xml, f"{loc}#1")
    if "screen.map" not in xml and "tab.map" not in xml:
        raise SystemExit(f"{loc}#1 not on map")
    cap(raw / "01-map-hero.png")

    # #2 active passage HUD — mid-Förde, no arrival modal
    seed_db(active=1)
    tap(135, 2029, 0.6)
    dismiss_modals()
    geo_at(*GEO_PASSAGE, n=8, kn=5.2)
    tap_id(rid="passage.preview.showOnMap", scrolls=0)
    xml = wait_map_clean(f"{loc}#2", *GEO_PASSAGE, kn=5.2)
    assert_not_forbidden(xml, f"{loc}#2")
    assert_map_clean(xml, f"{loc}#2")
    # Prefer passage chrome visible (Leg/Etappe/Next/Nächste) — soft warn only
    if not any(k in xml for k in ("Leg ", "Etappe", "Next ", "Nächste", "BRG", "passage.follow")):
        print("WARN #2 passage HUD chrome weak", flush=True)
    cap(raw / "02-map-passage.png")

    # #3 passage detail — ≥3 named waypoints in frame
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
    xml = wait_map_clean(f"{loc}#5", *GEO_OFFLINE, kn=6.8, timeout=55)
    assert_not_forbidden(xml, f"{loc}#5")
    assert_map_clean(xml, f"{loc}#5")
    cap(raw / "05-offline.png")
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
        "round": 4,
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
            "note": "R4: zero Jump/Sprung; clean DE#2 HUD; #3 ≥3 named WPs; #4 Kieler Bucht Ready; #5 distinct offline; lock held.",
        },
        "graphics": {"featureGraphic": "1024x500", "icon": "512x512"},
        "listing_source": "docs/play-store/LISTING-en.txt + LISTING-de.txt (no MT)",
        "changelogs": "fastlane .../changelogs/9.txt present en+de",
        "shot_list": ".cursor/store-farm/seacheck-play-shot-list.md",
        "capture_script": "mobile/seacheck/scripts/capture-play-r4.py",
        "r4_fixes": [
            "Dismiss/avoid Jump filtered + Sprung gefiltert before every map grab (#1/#2/#5)",
            "DE #2 clean active-passage HUD (no Wegpunkt-erreicht modal twin)",
            "EN+DE #3 Passage detail scrolled to ≥3 named Holtenau/Friedrichsort/Laboe rows",
            "EN+DE #4 scroll to Kieler Bucht/Bay sealed Ready pack card; keep green banner",
            "EN #5 distinct offline/airplane framing vs #1 hero",
            "AVD lock held on emulator-5602 for critic",
        ],
        "android_screenshots_refreshed": True,
        "updated_at": now,
        "status": "ready_for_critic",
        "visual_fix_queued": False,
    }
    (FARM / "visual-ready-seacheck-play.json").write_text(json.dumps(ready, indent=2) + "\n")
    (FARM / "status-seacheck-play.json").write_text(
        json.dumps(
            {
                "app": "seacheck",
                "store": "play",
                "status": "ready_for_critic",
                "ready_for_critic": True,
                "round": 4,
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
                "notes": "R4 landed; lock_held_for_critic — do not kill/release emulator-5602",
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
                    "status": "ready_for_critic",
                    "round": 4,
                    "ready_for_critic": True,
                    "visual_fix_queued": False,
                    "gap": "R4 ready_for_critic — Jump/Sprung+modal+#3+#4+#5 fixed; awaiting harsh critic wow≥9",
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
    print("WROTE visual-ready ready_for_critic:true round:4", flush=True)


def main():
    run_locale("en-US")
    run_locale("de-DE")
    write_ready()


if __name__ == "__main__":
    main()
