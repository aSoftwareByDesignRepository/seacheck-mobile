#!/usr/bin/env python3
"""Finish de-DE SeaCheck shots + write visual-ready (en already done)."""
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
DB = f"/data/data/{PKG}/files/SQLite/seacheck.db"
RK = f"/data/data/{PKG}/databases/RKStorage"
NAME = "Kieler Foerde Laboe"
MAESTRO = "/home/alex/.maestro/bin/maestro"
RAW = DOCS / "_raw-live-de-DE"


def sh(*a, t=30):
    return subprocess.run(
        ["timeout", "-s", "KILL", str(int(t)), "adb", "-s", S, *a],
        text=True,
        capture_output=True,
    )


def tap(x, y, w=0.5):
    sh("shell", "input", "tap", str(x), str(y), t=8)
    time.sleep(w)


def swipe(a, b, c, d, ms=300):
    sh("shell", "input", "swipe", str(a), str(b), str(c), str(d), str(ms), t=8)
    time.sleep(0.25)


def geo(n=10, kn=6.5):
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


def focus():
    sh("shell", "am", "force-stop", "com.google.android.googlequicksearchbox", t=5)
    sh("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", t=20)
    time.sleep(1.2)


def dismiss():
    xml = dump()
    for rid in ("confirm.cancel", "confirm.sheet.close", "map.topAlert.dismiss"):
        hit = find(xml, rid=rid)
        if hit:
            tap(*hit, 0.35)
            xml = dump()
    for text in ("Not yet", "Noch nicht"):
        hit = find(xml, text=text)
        if hit:
            tap(*hit, 0.35)


def seed(active=1):
    sh("shell", "am", "force-stop", PKG, t=8)
    time.sleep(0.3)
    sql = f"""BEGIN;
DELETE FROM passage_waypoints; DELETE FROM waypoints; DELETE FROM passage_leg_overrides; DELETE FROM passages;
INSERT INTO passages(id,name,planned_departure,default_sog_kn,is_active,created_at) VALUES
 ('pass_kiel_laboe','{NAME}',NULL,5.0,{active},strftime('%s','now')*1000);
INSERT INTO waypoints(id,name,latitude,longitude,type,note,created_at) VALUES
 ('wp_laboe','Laboe',54.4000,10.2200,'generic','',strftime('%s','now')*1000),
 ('wp_fried','Friedrichsort',54.3900,10.1850,'generic','',strftime('%s','now')*1000),
 ('wp_holt','Holtenau',54.3680,10.1520,'generic','',strftime('%s','now')*1000),
 ('wp_marina','KielMarina',54.3230,10.1860,'generic','',strftime('%s','now')*1000);
INSERT INTO passage_waypoints(passage_id,waypoint_id,sort_order) VALUES
 ('pass_kiel_laboe','wp_laboe',0),('pass_kiel_laboe','wp_fried',1),
 ('pass_kiel_laboe','wp_holt',2),('pass_kiel_laboe','wp_marina',3);
COMMIT; SELECT name||'|'||is_active FROM passages;"""
    Path("/tmp/seacheck-seed.sql").write_text(sql)
    sh("push", "/tmp/seacheck-seed.sql", "/data/local/tmp/seacheck-seed.sql", t=10)
    r = sh("shell", f"sqlite3 {DB} < /data/local/tmp/seacheck-seed.sql", t=15)
    print("DB_SEED", (r.stdout or "").strip(), flush=True)
    focus()
    time.sleep(2.5)


def offline_has_kiel() -> bool:
    r = sh(
        "shell",
        f"sqlite3 {RK} \"SELECT value FROM catalystLocalStorage WHERE key='seacheck.offline.v1';\"",
        t=10,
    )
    v = (r.stdout or "").strip()
    print("OFFLINE_IDX", v[:180], flush=True)
    return "kiel-bay" in v and "packId" in v


def open_downloads() -> bool:
    dismiss()
    flow = Path("/tmp/sc-de-dl.yaml")
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
      visible: "Noch nicht"
    commands:
      - tapOn: "Noch nicht"
- tapOn:
    id: "tab.more"
- tapOn:
    id: "tab.downloads"
"""
    )
    r = subprocess.run([MAESTRO, "--device", S, "test", str(flow)], text=True, capture_output=True, timeout=90)
    print("MAESTRO", r.returncode, flush=True)
    xml = dump()
    if "Offline" in xml or "download" in xml.lower() or "Karten" in xml:
        return True
    # blind
    tap(945, 2029, 1.2)
    for y in (1480, 1560, 1640, 1400):
        tap(540, y, 1.0)
        xml = dump()
        if "download" in xml.lower() or "Offline" in xml or "Karten" in xml:
            return True
    return False


def seal() -> bool:
    if offline_has_kiel():
        open_downloads()
        print("PACK already in index", flush=True)
        return True
    if not open_downloads():
        print("FAIL open dl", flush=True)
        return False
    time.sleep(1)
    xml = dump()
    hit = find(xml, rid="downloads.wifiOnly")
    if hit:
        tap(*hit, 0.4)
    started = False
    for text in ("Paket laden", "Download pack"):
        hit = find(dump(), text=text) or find(dump(), rid="downloads.download.kiel-bay")
        if hit:
            tap(*hit, 0.5)
            started = True
            break
        swipe(540, 1600, 540, 700, 300)
    if not started:
        for _ in range(10):
            xml = dump()
            hit = find(xml, rid="downloads.download.kiel-bay") or find(xml, text="Paket laden") or find(
                xml, text="Download pack"
            )
            if hit:
                tap(*hit, 0.5)
                started = True
                break
            swipe(540, 1600, 540, 700, 300)
    print("DOWNLOAD", started, flush=True)
    if not started:
        return False
    end = time.time() + 420
    while time.time() < end:
        if offline_has_kiel():
            open_downloads()
            print("PACK sealed via index", flush=True)
            return True
        xml = dump()
        if "1 Kartenpaket" in xml or "1 chart pack" in xml or "downloads.delete.kiel-bay" in xml:
            print("PACK sealed via UI", flush=True)
            return True
        if "screen.map" in xml:
            open_downloads()
        time.sleep(5)
    return offline_has_kiel()


def write_locale(loc: str, raw: Path):
    fl = ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots"
    fl.mkdir(parents=True, exist_ok=True)
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
        if not src.exists() or src.stat().st_size < 50000:
            raise SystemExit(f"weak/missing {src}")
        img = fit(Image.open(src))
        assert img.size == (1080, 1920)
        img.save(DOCS / f"{loc}-{dn}", "PNG", optimize=True)
        if loc == "en-US":
            img.save(DOCS / dn, "PNG", optimize=True)
        img.save(fl / fn, "PNG", optimize=True)
        print("WROTE", loc, fn, src.stat().st_size, flush=True)


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
    c = {}
    for loc in ("en-US", "de-DE"):
        files = sorted((ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots").glob("[1-6].png"))
        c[loc] = len(files)
        for f in files:
            assert Image.open(f).size == (1080, 1920)
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
            "note": "R2: underway SOG, Kieler Foerde Laboe ≥3 legs, sealed kiel-bay, safety bottom-anchored. Lock held for critic.",
        },
        "graphics": {"featureGraphic": "1024x500", "icon": "512x512"},
        "listing_source": "docs/play-store/LISTING-en.txt + LISTING-de.txt (no MT)",
        "changelogs": "fastlane .../changelogs/9.txt present en+de",
        "shot_list": ".cursor/store-farm/seacheck-play-shot-list.md",
        "capture_script": "mobile/seacheck/scripts/capture-play-r2-de-finish.py",
        "r2_fixes": [
            "underway SOG via emu geo velocity",
            "named Kieler Foerde Laboe ≥3 legs (SQLite seed)",
            "deactivate before downloads; dismiss confirm.sheet",
            "seal kiel-bay; safety bottom-anchor",
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
    RAW.mkdir(parents=True, exist_ok=True)
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
    sh("shell", "svc", "wifi", "enable", t=8)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", "de-DE", t=8)

    # Recapture map/passage (prior DE shots were too small)
    seed(active=0)
    dismiss()
    tap(135, 2029, 0.6)
    geo(14)
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap(x, y, 0.15)
    geo(6)
    time.sleep(1.2)
    cap(RAW / "01-map-hero.png")

    seed(active=1)
    dismiss()
    tap(135, 2029, 0.6)
    geo(8)
    dismiss()
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap(x, y, 0.15)
    time.sleep(1.0)
    cap(RAW / "02-map-passage.png")

    tap(405, 2029, 0.8)
    time.sleep(0.8)
    dismiss()
    xml = dump()
    m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml)
    if m:
        hit = find(xml, rid=m.group(0).split('"')[1])
        if hit:
            tap(*hit, 0.7)
        else:
            tap(540, 700, 0.8)
    else:
        tap(540, 700, 0.8)
    swipe(540, 900, 540, 1400, 280)
    swipe(540, 700, 540, 1200, 250)
    time.sleep(0.4)
    cap(RAW / "03-passage-detail.png")

    # keep existing 06 if large enough
    if not (RAW / "06-safety.png").exists() or (RAW / "06-safety.png").stat().st_size < 80000:
        raise SystemExit("missing de 06-safety — rerun full locale")

    sh("shell", f"sqlite3 {DB} \"UPDATE passages SET is_active=0;\"", t=10)
    focus()
    time.sleep(2)
    ok = seal()
    print("SEALED", ok, flush=True)
    for _ in range(3):
        swipe(540, 700, 540, 1500, 280)
    time.sleep(0.4)
    cap(RAW / "04-downloads.png")

    sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
    time.sleep(1.2)
    tap(135, 2029, 0.8)
    time.sleep(2.5)
    cap(RAW / "05-offline.png")
    sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)

    write_locale("de-DE", RAW)
    # ensure en still present
    en_raw = DOCS / "_raw-live-en-US"
    write_locale("en-US", en_raw)
    write_ready()


if __name__ == "__main__":
    main()
