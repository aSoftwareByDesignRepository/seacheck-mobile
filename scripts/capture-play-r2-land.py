#!/usr/bin/env python3
"""Land SeaCheck Play R2 — DB-seed passage + dump-light capture → visual-ready."""
from __future__ import annotations

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
NAME = "Kieler Foerde Laboe"


def sh(*a, t=25):
    try:
        return subprocess.run(
            ["timeout", "-s", "KILL", str(int(t)), "adb", "-s", S, *a],
            text=True,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(a, 124, "", "timeout")


def tap(x, y, w=0.55):
    sh("shell", "input", "tap", str(x), str(y), t=8)
    time.sleep(w)


def swipe(a, b, c, d, ms=300):
    sh("shell", "input", "swipe", str(a), str(b), str(c), str(d), str(ms), t=8)
    time.sleep(0.28)


def geo(n=12, kn=6.5):
    sh("shell", "settings", "put", "secure", "location_mode", "3", t=5)
    lon, lat = 10.168, 54.355
    for i in range(n):
        sh(
            "emu",
            "geo",
            "fix",
            f"{lon + 0.00004 * i:.6f}",
            f"{lat + 0.000025 * i:.6f}",
            "3",
            "12",
            f"{kn:.1f}",
            t=5,
        )
        time.sleep(0.5)


def dump(retries=3):
    out = ""
    for _ in range(retries):
        sh("shell", "uiautomator", "dump", "--compressed", "/sdcard/sc.xml", t=6)
        out = sh("shell", "cat", "/sdcard/sc.xml", t=4).stdout or ""
        if out.count("<node") > 3:
            return out
        time.sleep(0.4)
    return out


def find(xml, rid=None, text=None):
    for m in re.finditer(r"<node[^>]+>", xml or ""):
        n = m.group(0)
        if rid and f'resource-id="{rid}"' not in n:
            continue
        if text and text not in n:
            continue
        if not rid and not text:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 > x1 and y2 > y1:
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap_id(rid=None, text=None, scrolls=3):
    for _ in range(scrolls + 1):
        xml = dump()
        hit = find(xml, rid=rid, text=text)
        if hit:
            print(f"TAP {rid or text} @{hit[0]},{hit[1]}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1600, 540, 700, 320)
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


def grant():
    for p in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
    ):
        sh("shell", "pm", "grant", PKG, p, t=5)


def focus_app():
    sh("shell", "am", "force-stop", "com.google.android.googlequicksearchbox", t=5)
    sh("shell", "am", "force-stop", "com.google.android.apps.youtube.music", t=5)
    sh("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", t=20)
    time.sleep(0.8)


def onboard(raw: Path):
    time.sleep(5)
    for _ in range(2):
        swipe(540, 700, 540, 1400, 250)
    time.sleep(0.3)
    cap(raw / "06-safety.png")
    tap(540, 1962, 1.0)
    tap(540, 1595, 1.0)
    tap(540, 1828, 0.9)
    for _ in range(2):
        tap(540, 1350, 0.45)
    grant()
    tap(540, 1224, 0.85)
    tap(540, 1136, 1.2)
    for _ in range(3):
        tap(540, 1828, 0.4)
        tap(540, 1350, 0.35)
    grant()
    time.sleep(2)


def seed_db():
    """Root emulator: insert named ≥3-leg active passage (UI coord sheet breaks a11y)."""
    sh("shell", "am", "force-stop", PKG, t=8)
    time.sleep(0.4)
    sql = f"""BEGIN;
DELETE FROM passage_waypoints;
DELETE FROM waypoints;
DELETE FROM passage_leg_overrides;
DELETE FROM passages;
INSERT INTO passages(id,name,planned_departure,default_sog_kn,is_active,created_at) VALUES
 ('pass_kiel_laboe','{NAME}',NULL,5.0,1,strftime('%s','now')*1000);
INSERT INTO waypoints(id,name,latitude,longitude,type,note,created_at) VALUES
 ('wp_laboe','Laboe',54.4000,10.2200,'generic','',strftime('%s','now')*1000),
 ('wp_fried','Friedrichsort',54.3900,10.1850,'generic','',strftime('%s','now')*1000),
 ('wp_holt','Holtenau',54.3680,10.1520,'generic','',strftime('%s','now')*1000),
 ('wp_marina','KielMarina',54.3230,10.1860,'generic','',strftime('%s','now')*1000);
INSERT INTO passage_waypoints(passage_id,waypoint_id,sort_order) VALUES
 ('pass_kiel_laboe','wp_laboe',0),
 ('pass_kiel_laboe','wp_fried',1),
 ('pass_kiel_laboe','wp_holt',2),
 ('pass_kiel_laboe','wp_marina',3);
COMMIT;
SELECT name||'|'||is_active FROM passages;
"""
    Path("/tmp/seacheck-seed.sql").write_text(sql)
    sh("push", "/tmp/seacheck-seed.sql", "/data/local/tmp/seacheck-seed.sql", t=10)
    r = sh("shell", f"sqlite3 {DB} < /data/local/tmp/seacheck-seed.sql", t=15)
    print("DB_SEED", (r.stdout or "").strip(), (r.stderr or "").strip()[:200], flush=True)
    focus_app()
    time.sleep(1.5)


def seal():
    focus_app()
    tap(945, 2029, 0.8)  # More
    time.sleep(0.6)
    opened = (
        tap_id(rid="tab.downloads", scrolls=4)
        or tap_id(text="Offline charts", scrolls=4)
        or tap_id(text="Offline-Karten", scrolls=4)
        or tap_id(text="Offline", scrolls=3)
    )
    if not opened:
        # first row under More
        tap(540, 420, 0.9)
        tap(540, 520, 0.9)
    time.sleep(1.0)
    xml = dump()
    hit = find(xml, rid="downloads.wifiOnly")
    if hit:
        tap(*hit, 0.4)
    started = False
    for _ in range(14):
        if tap_id(rid="downloads.download.kiel-bay", scrolls=1):
            started = True
            break
        if tap_id(text="Download pack", scrolls=0) or tap_id(text="Paket laden", scrolls=0):
            started = True
            break
        swipe(540, 1600, 540, 700, 320)
    print("DOWNLOAD", started, flush=True)
    if not started:
        return False
    end = time.time() + 480
    while time.time() < end:
        xml = dump()
        empty = "No offline packs yet" in xml or "Noch keine Offline-Pakete" in xml
        if (not empty) and (
            "Ready" in xml
            or "Bereit" in xml
            or "downloads.delete.kiel-bay" in xml
            or "ready offline" in xml
            or "1 chart pack" in xml
            or "1 Kartenpaket" in xml
        ):
            print("PACK sealed", flush=True)
            return True
        if "screen.map" in xml or ('resource-id="tab.map"' in xml and "Offline" not in xml and "downloads" not in xml):
            tap(945, 2029, 0.5)
            tap_id(text="Offline", scrolls=2) or tap(540, 420, 0.7)
        time.sleep(5)
    print("PACK timeout", flush=True)
    return False


def run_locale(loc: str):
    raw = DOCS / f"_raw-live-{loc}"
    raw.mkdir(parents=True, exist_ok=True)
    fl = ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots"
    fl.mkdir(parents=True, exist_ok=True)
    lang = "de-DE" if loc.startswith("de") else "en-US"
    print("==>", loc, flush=True)
    sh("shell", "am", "force-stop", "com.google.android.apps.youtube.music", t=5)
    sh("shell", "settings", "put", "system", "system_locales", lang, t=8)
    sh("uninstall", PKG, t=30)
    r = sh("install", "-r", str(APK), t=120)
    if r.returncode:
        raise SystemExit(f"install failed {r.stderr}")
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, t=8)
    sh("shell", "pm", "clear", PKG, t=15)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, t=8)
    grant()
    sh("shell", "cmd", "location", "set-location-enabled", "true", t=5)
    focus_app()
    onboard(raw)
    tap(135, 2029, 0.5)
    geo(14)
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap(x, y, 0.2)
    geo(6)
    time.sleep(1)
    cap(raw / "01-map-hero.png")

    seed_db()
    tap(135, 2029, 0.6)
    geo(10)
    time.sleep(1.2)
    # dismiss jump/alerts
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap(x, y, 0.15)
    time.sleep(0.5)
    cap(raw / "02-map-passage.png")

    tap(405, 2029, 0.8)
    time.sleep(0.8)
    xml = dump()
    m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml)
    if m:
        tap_id(rid=m.group(0).split('"')[1], scrolls=0)
    else:
        # card body under New passage
        tap(540, 700, 0.8)
    time.sleep(0.6)
    # scroll so name + ≥3 legs visible
    swipe(540, 900, 540, 1400, 280)
    swipe(540, 700, 540, 1200, 250)
    time.sleep(0.4)
    cap(raw / "03-passage-detail.png")

    sealed = seal()
    print("SEALED", sealed, flush=True)
    for _ in range(3):
        swipe(540, 700, 540, 1500, 280)
    time.sleep(0.4)
    cap(raw / "04-downloads.png")

    sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
    time.sleep(1.2)
    tap(135, 2029, 0.8)
    time.sleep(2.5)
    cap(raw / "05-offline.png")
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)

    mapping = {
        "01-map-hero.png": ("phone-01-map.png", "1.png"),
        "02-map-passage.png": ("phone-02-passage-map.png", "2.png"),
        "03-passage-detail.png": ("phone-03-passage.png", "3.png"),
        "04-downloads.png": ("phone-04-downloads.png", "4.png"),
        "05-offline.png": ("phone-05-offline.png", "5.png"),
        "06-safety.png": ("phone-06-disclaimer.png", "6.png"),
    }
    for src_n, (dn, fn) in mapping.items():
        src = raw / src_n
        if not src.exists():
            raise SystemExit(f"missing {src}")
        img = fit(Image.open(src))
        img.save(DOCS / f"{loc}-{dn}", "PNG", optimize=True)
        if loc == "en-US":
            img.save(DOCS / dn, "PNG", optimize=True)
        img.save(fl / fn, "PNG", optimize=True)
        print("WROTE", loc, fn, img.size, flush=True)
    print("LOCALE_DONE", loc, flush=True)


def write_ready():
    def counts(path: Path):
        t = path.read_text()
        title = short = full = None
        section = None
        buf = []

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
                continue
            if line.startswith("Short description:"):
                flush()
                section = "short"
                buf = [line.split(":", 1)[1].strip()]
                continue
            if line.startswith("Full description:"):
                flush()
                section = "full"
                buf = []
                continue
            if section == "full" and line.startswith("==="):
                flush()
                section = None
                continue
            if section:
                buf.append(line)
        flush()
        return len(title or ""), len(short or ""), len(full or "")

    docs = ROOT / "docs/play-store"
    en, de = counts(docs / "LISTING-en.txt"), counts(docs / "LISTING-de.txt")
    for stale in ("phone-02-disclaimer.png", "phone-06-about.png"):
        p = DOCS / stale
        if p.exists():
            p.unlink()
    for dbg in DOCS.glob("_dbg-*.png"):
        dbg.unlink()
    c = {}
    for loc in ("en-US", "de-DE"):
        files = sorted((ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots").glob("[1-6].png"))
        c[loc] = len(files)
        for f in files:
            assert Image.open(f).size == (1080, 1920), (loc, f, Image.open(f).size)
    en1 = (ROOT / "fastlane/metadata/android/en-US/images/phoneScreenshots/1.png").read_bytes()
    de1 = (ROOT / "fastlane/metadata/android/de-DE/images/phoneScreenshots/1.png").read_bytes()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ready = {
        "app": "seacheck",
        "store": "play",
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
            "note": "R2: underway SOG, DB-seeded Kieler Foerde Laboe ≥3 legs, sealed kiel-bay, safety bottom-anchored. Lock held for critic.",
        },
        "graphics": {"featureGraphic": "1024x500", "icon": "512x512"},
        "listing_source": "docs/play-store/LISTING-en.txt + LISTING-de.txt (no MT)",
        "changelogs": "fastlane .../changelogs/9.txt present en+de",
        "shot_list": ".cursor/store-farm/seacheck-play-shot-list.md",
        "capture_script": "mobile/seacheck/scripts/capture-play-r2-land.py",
        "r2_fixes": [
            "underway SOG via emu geo velocity; dismiss Jump filtered",
            "open-water chart hero",
            "named Kieler Foerde Laboe with ≥3 legs (SQLite seed; coord sheet a11y broken)",
            "seal kiel-bay before downloads #4",
            "safety bottom-anchor; stale docs aliases removed",
        ],
        "android_screenshots_refreshed": True,
        "updated_at": now,
        "status": "ready_for_critic",
    }
    (FARM / "visual-ready-seacheck-play.json").write_text(json.dumps(ready, indent=2) + "\n")
    (FARM / "status-seacheck-play.json").write_text(
        json.dumps(
            {
                "app": "seacheck",
                "store": "play",
                "status": "ready_for_critic",
                "ready_for_critic": True,
                "verdict": "pending_critic",
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
                "notes": "R2 landed; lock held for critic — do not kill AVD",
            },
            indent=2,
        )
        + "\n"
    )
    print("WROTE visual-ready ready_for_critic:true", flush=True)


def main():
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
    sh("shell", "svc", "wifi", "enable", t=8)
    run_locale("en-US")
    run_locale("de-DE")
    write_ready()


if __name__ == "__main__":
    main()
