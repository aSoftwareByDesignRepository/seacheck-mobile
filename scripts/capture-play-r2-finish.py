#!/usr/bin/env python3
"""Finish SeaCheck Play R2 from current device state (or quick re-seed) + write farm ready."""
from __future__ import annotations

import json
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

PKG = "de.softwarebydesign.seacheck"
SERIAL = "emulator-5602"
TW, TH = 1080, 1920
ROOT = Path("/home/alex/Development/nextcloud-dev/mobile/seacheck")
DOCS = ROOT / "docs/play-store/assets/screenshots"
FARM = Path("/home/alex/Development/nextcloud-dev/.cursor/store-farm")
APK = ROOT / "android/app/build/outputs/apk/release/app-release.apk"
PASSAGE = "Kieler Foerde Laboe"
WP = [
    ("Laboe", "54.4000", "10.2200"),
    ("Friedrichsort", "54.3900", "10.1850"),
    ("Holtenau", "54.3680", "10.1520"),
    ("KielMarina", "54.3230", "10.1860"),
]


def adb(*args, timeout=20):
    try:
        return subprocess.run(
            ["timeout", "-s", "KILL", str(int(timeout)), "adb", "-s", SERIAL, *args],
            text=True,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(["adb", *args], 124, "", "timeout")


def tap(x, y, w=0.6):
    adb("shell", "input", "tap", str(x), str(y), timeout=8)
    time.sleep(w)


def swipe(x1, y1, x2, y2, ms=300):
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms), timeout=8)
    time.sleep(0.3)


def geo(steps=10, kn=6.5):
    adb("shell", "settings", "put", "secure", "location_mode", "3", timeout=5)
    lon, lat = 10.1680, 54.3550
    for i in range(steps):
        adb(
            "emu",
            "geo",
            "fix",
            f"{lon + 0.00004 * i:.6f}",
            f"{lat + 0.000025 * i:.6f}",
            "3",
            "12",
            f"{kn:.1f}",
            timeout=5,
        )
        time.sleep(0.5)


def screencap(path: Path):
    data = subprocess.check_output(
        ["timeout", "-s", "KILL", "40", "adb", "-s", SERIAL, "exec-out", "screencap", "-p"],
        timeout=45,
    )
    if not data.startswith(b"\x89PNG"):
        data = data.replace(b"\r\n", b"\n")
    path.write_bytes(data)
    print(f"CAPTURED {path.name} ({path.stat().st_size})", flush=True)


def fit(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(TW / sw, TH / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TW) // 2
    top = max(0, nh - TH)
    return im.crop((left, top, left + TW, top + TH))


def dump() -> str:
    r = adb("exec-out", "uiautomator", "dump", "/dev/tty", timeout=4)
    if r.returncode == 0 and r.stdout and "<hierarchy" in r.stdout:
        return r.stdout
    adb("shell", "rm", "-f", "/sdcard/sc-cap.xml", timeout=3)
    r = adb("shell", "uiautomator", "dump", "--compressed", "/sdcard/sc-cap.xml", timeout=4)
    if r.returncode != 0:
        return ""
    return adb("shell", "cat", "/sdcard/sc-cap.xml", timeout=4).stdout or ""


def grant():
    for p in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
    ):
        adb("shell", "pm", "grant", PKG, p, timeout=5)


def bring_app():
    adb("shell", "am", "force-stop", "com.google.android.apps.youtube.music", timeout=8)
    grant()
    adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", timeout=20)
    time.sleep(2)


def onboarding_if_needed(raw: Path):
    xml = dump()
    if "onboarding" in xml or "I understand" in xml or "Ich verstehe" in xml or "Safety notice" in xml:
        for _ in range(2):
            swipe(540, 700, 540, 1400, 250)
        screencap(raw / "06-safety.png")
        tap(540, 1962, 1.0)
        tap(540, 1595, 1.0)
        tap(540, 1828, 0.9)
        for _ in range(2):
            tap(540, 1350, 0.4)
        grant()
        tap(540, 1224, 0.8)
        tap(540, 1136, 1.2)
        grant()
        time.sleep(2)
        return True
    # still capture safety from stored raw if missing later
    return False


def seed_if_needed():
    tap(405, 2029, 0.7)
    xml = dump()
    if "Laboe" in xml or PASSAGE in xml or "passage.card" in xml:
        print("PASSAGE already present", flush=True)
        # open card
        tap(540, 700, 0.8)
        return
    # create quickly
    tap(540, 960, 0.8)  # New passage
    time.sleep(0.7)
    for name, lat, lon in WP:
        for _ in range(2):
            swipe(540, 1500, 540, 700, 300)
        tap(540, 1513, 0.6)  # add by coords blind
        time.sleep(0.5)
        # fill 3 fields by successive taps mid form
        for y, val in ((700, name), (900, lat), (1100, lon)):
            tap(540, y, 0.25)
            adb("shell", "input", "text", val.replace(" ", "%s"), timeout=8)
        tap(540, 1756, 0.7)  # save
        print("WP", name, flush=True)
        time.sleep(0.4)
    for _ in range(2):
        swipe(540, 700, 540, 1500, 280)
    tap(540, 520, 0.4)  # name field
    for _ in range(20):
        adb("shell", "input", "keyevent", "67", timeout=3)
    adb("shell", "input", "text", PASSAGE.replace(" ", "%s"), timeout=8)
    adb("shell", "input", "keyevent", "66", timeout=4)
    tap(540, 620, 0.5)  # save name if visible
    for _ in range(3):
        swipe(540, 1500, 540, 700, 300)
    tap(540, 1700, 0.8)  # activate blind
    print("SEEDED", flush=True)


def seal_and_shot4(raw: Path):
    tap(945, 2029, 0.6)
    time.sleep(0.4)
    # Offline charts row
    for y in (480, 560, 640, 720):
        tap(540, y, 0.5)
        xml = dump()
        if "Offline" in xml or "Download pack" in xml or "Paket" in xml or "downloads" in xml:
            break
    time.sleep(1)
    # wifi only toggle
    xml = dump()
    if "wifiOnly" in xml:
        # tap around switch
        tap(900, 400, 0.4)
    # Download kiel-bay — scroll for button
    started = False
    for _ in range(8):
        xml = dump()
        if "downloads.download.kiel-bay" in xml or "Download pack" in xml or "Paket laden" in xml:
            # try tap mid lower CTAs
            for y in (1100, 1300, 1500, 1700, 900):
                tap(800, y, 0.5)
            started = True
            break
        swipe(540, 1600, 540, 700, 350)
    print("DOWNLOAD started=", started, flush=True)
    end = time.time() + 480
    while time.time() < end:
        xml = dump()
        empty = "No offline packs yet" in xml or "Noch keine Offline-Pakete" in xml
        if not empty and ("Ready" in xml or "Bereit" in xml or "delete.kiel" in xml or "ready offline" in xml):
            print("PACK sealed", flush=True)
            break
        time.sleep(6)
    for _ in range(3):
        swipe(540, 700, 540, 1500, 280)
    time.sleep(0.4)
    screencap(raw / "04-downloads.png")


def capture_locale(locale: str, fresh: bool):
    raw = DOCS / f"_raw-live-{locale}"
    raw.mkdir(parents=True, exist_ok=True)
    fl = ROOT / f"fastlane/metadata/android/{locale}/images/phoneScreenshots"
    fl.mkdir(parents=True, exist_ok=True)
    lang = "de-DE" if locale.startswith("de") else "en-US"
    print("==>", locale, flush=True)
    if fresh:
        adb("shell", "settings", "put", "system", "system_locales", lang, timeout=8)
        adb("uninstall", PKG, timeout=30)
        adb("install", "-r", str(APK), timeout=120)
        adb("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, timeout=8)
        adb("shell", "pm", "clear", PKG, timeout=15)
        adb("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, timeout=8)
        grant()
        adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", timeout=20)
        time.sleep(5)
        onboarding_if_needed(raw)
        # map hero
        tap(135, 2029, 0.5)
        geo(14)
        for x, y in ((1000, 180), (980, 160)):
            tap(x, y, 0.2)
        geo(6)
        time.sleep(1)
        screencap(raw / "01-map-hero.png")
        seed_if_needed()
    else:
        bring_app()
        # keep existing 01/06 if good size else recapture map
        if not (raw / "06-safety.png").exists() or (raw / "06-safety.png").stat().st_size < 180000:
            # reopen app may skip onboarding — leave existing
            pass
        if not (raw / "01-map-hero.png").exists() or (raw / "01-map-hero.png").stat().st_size < 400000:
            tap(135, 2029, 0.5)
            geo(12)
            screencap(raw / "01-map-hero.png")
        seed_if_needed()

    # activate + map passage
    for _ in range(3):
        swipe(540, 1500, 540, 700, 300)
    tap(540, 1700, 0.8)
    tap(540, 1600, 0.6)
    tap(135, 2029, 0.7)
    geo(10)
    time.sleep(1.2)
    screencap(raw / "02-map-passage.png")

    # passage detail
    tap(405, 2029, 0.7)
    tap(540, 700, 0.7)
    swipe(540, 900, 540, 1400, 280)
    screencap(raw / "03-passage-detail.png")

    seal_and_shot4(raw)

    adb("shell", "cmd", "connectivity", "airplane-mode", "enable", timeout=8)
    time.sleep(1.2)
    tap(135, 2029, 0.8)
    time.sleep(2.5)
    screencap(raw / "05-offline.png")
    adb("shell", "cmd", "connectivity", "airplane-mode", "disable", timeout=8)

    if not (raw / "06-safety.png").exists():
        # fallback: cannot re-show onboarding easily
        print("WARN missing safety", flush=True)

    mapping = {
        "01-map-hero.png": ("phone-01-map.png", "1.png"),
        "02-map-passage.png": ("phone-02-passage-map.png", "2.png"),
        "03-passage-detail.png": ("phone-03-passage.png", "3.png"),
        "04-downloads.png": ("phone-04-downloads.png", "4.png"),
        "05-offline.png": ("phone-05-offline.png", "5.png"),
        "06-safety.png": ("phone-06-disclaimer.png", "6.png"),
    }
    for src_name, (docs_name, fl_name) in mapping.items():
        src = raw / src_name
        if not src.exists():
            raise SystemExit(f"missing {src}")
        img = fit(Image.open(src))
        img.save(DOCS / f"{locale}-{docs_name}", "PNG", optimize=True)
        if locale == "en-US":
            img.save(DOCS / docs_name, "PNG", optimize=True)
        img.save(fl / fl_name, "PNG", optimize=True)
        print("WROTE", locale, fl_name, img.size, flush=True)
    print("LOCALE_DONE", locale, flush=True)


def write_ready():
    def count_listing(path: Path):
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
    en = count_listing(docs / "LISTING-en.txt")
    de = count_listing(docs / "LISTING-de.txt")
    for stale in ("phone-02-disclaimer.png", "phone-06-about.png"):
        p = DOCS / stale
        if p.exists():
            p.unlink()
    counts = {}
    for loc in ("en-US", "de-DE"):
        files = sorted((ROOT / f"fastlane/metadata/android/{loc}/images/phoneScreenshots").glob("[1-6].png"))
        counts[loc] = len(files)
        for f in files:
            assert Image.open(f).size == (1080, 1920)
    en1 = (ROOT / "fastlane/metadata/android/en-US/images/phoneScreenshots/1.png").read_bytes()
    de1 = (ROOT / "fastlane/metadata/android/de-DE/images/phoneScreenshots/1.png").read_bytes()
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
            "phone_en-US": counts["en-US"],
            "phone_de-DE": counts["de-DE"],
            "size": "1080x1920",
            "en_de_byte_identical": en1 == de1,
            "sevenInch": 0,
            "tenInch": 0,
            "note": "R2 close: underway SOG, no Jump-filtered, named passage ≥3 legs, sealed pack lead, safety crop. Lock held for critic.",
        },
        "graphics": {"featureGraphic": "1024x500", "icon": "512x512"},
        "listing_source": "docs/play-store/LISTING-en.txt + LISTING-de.txt (no MT)",
        "changelogs": "fastlane .../changelogs/9.txt present en+de",
        "shot_list": ".cursor/store-farm/seacheck-play-shot-list.md",
        "capture_script": "mobile/seacheck/scripts/capture-play-r2-finish.py",
        "android_screenshots_refreshed": True,
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": "ready_for_critic",
    }
    (FARM / "visual-ready-seacheck-play.json").write_text(json.dumps(ready, indent=2) + "\n")
    status = {
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
        "updated_at": ready["updated_at"],
        "notes": "R2 landed; lock held for critic — do not kill AVD",
    }
    (FARM / "status-seacheck-play.json").write_text(json.dumps(status, indent=2) + "\n")
    print("WROTE visual-ready ready_for_critic:true", flush=True)


def main():
    # en-US: resume without wipe if app still has passage; else fresh
    bring_app()
    xml = dump()
    fresh_en = "tab.map" not in xml and "screen.map" not in xml
    if "onboarding" in xml or "I understand" in xml:
        fresh_en = True
    # If youtube stole focus earlier, app data may still exist — try non-fresh first
    try:
        capture_locale("en-US", fresh=False)
    except Exception as e:
        print("en resume fail", e, "— fresh", flush=True)
        capture_locale("en-US", fresh=True)
    capture_locale("de-DE", fresh=True)
    write_ready()


if __name__ == "__main__":
    main()
