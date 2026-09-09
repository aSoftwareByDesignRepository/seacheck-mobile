#!/usr/bin/env python3
"""SeaCheck Play R2 fast capture — dump-light (uiautomator hangs on MapLibre).

Fixes critic next_actions:
  #1/#2 no Jump filtered + underway SOG via geo velocity
  #3 named passage ≥3 legs
  #4 sealed pack lead (not empty)
  #6 full disclaimer via bottom-anchor crop
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

PKG = "de.softwarebydesign.seacheck"
TW, TH = 1080, 1920
PASSAGE_NAME = "Kieler Foerde Laboe"
WP = [
    ("Laboe", "54.4000", "10.2200"),
    ("Friedrichsort", "54.3900", "10.1850"),
    ("Holtenau", "54.3680", "10.1520"),
    ("KielMarina", "54.3230", "10.1860"),
]


def adb(serial: str, *args: str, check: bool = False, timeout: float = 20) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["timeout", "-s", "KILL", str(int(timeout)), "adb", "-s", serial, *args],
            check=check,
            text=True,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        print(f"WARN adb timeout {' '.join(args[:3])}", flush=True)
        adb_kill_ui(serial)
        return subprocess.CompletedProcess(["adb", *args], 124, "", "timeout")


def adb_kill_ui(serial: str) -> None:
    subprocess.run(
        ["timeout", "3", "adb", "-s", serial, "shell", "pkill", "-9", "uiautomator"],
        capture_output=True,
        check=False,
    )


def adb_bytes(serial: str, *args: str) -> bytes:
    return subprocess.check_output(
        ["timeout", "-s", "KILL", "40", "adb", "-s", serial, *args],
        timeout=45,
    )


def tap(serial: str, x: int, y: int, wait: float = 0.7) -> None:
    adb(serial, "shell", "input", "tap", str(x), str(y), timeout=8)
    time.sleep(wait)


def swipe(serial: str, x1: int, y1: int, x2: int, y2: int, ms: int = 300) -> None:
    adb(serial, "shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms), timeout=8)
    time.sleep(0.35)


def long_press(serial: str, x: int, y: int, ms: int = 1100) -> None:
    adb(serial, "shell", "input", "swipe", str(x), str(y), str(x), str(y), str(ms), timeout=10)
    time.sleep(0.7)


def dump(serial: str) -> str:
    """Fast-fail hierarchy dump — never block capture for long."""
    r = adb(serial, "exec-out", "uiautomator", "dump", "/dev/tty", timeout=4)
    if r.returncode == 0 and r.stdout and "<hierarchy" in r.stdout:
        return r.stdout
    adb(serial, "shell", "rm", "-f", "/sdcard/sc-cap.xml", timeout=3)
    r = adb(serial, "shell", "uiautomator", "dump", "--compressed", "/sdcard/sc-cap.xml", timeout=4)
    if r.returncode != 0:
        adb_kill_ui(serial)
        return ""
    out = adb(serial, "shell", "cat", "/sdcard/sc-cap.xml", timeout=4)
    return out.stdout or ""


def find_tap(xml: str, *, rid: str | None = None, text: str | None = None):
    for node in re.finditer(r"<node[^>]+>", xml):
        n = node.group(0)
        if rid and f'resource-id="{rid}"' not in n:
            continue
        if text and text not in n:
            continue
        if rid is None and text is None:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap_rid_or_text(serial: str, rid: str | None = None, text: str | None = None, scrolls: int = 2) -> bool:
    for _ in range(scrolls + 1):
        xml = dump(serial)
        hit = find_tap(xml, rid=rid, text=text) if xml else None
        if hit:
            print(f"TAP {rid or text} @{hit[0]},{hit[1]}", flush=True)
            tap(serial, hit[0], hit[1])
            return True
        swipe(serial, 540, 1600, 540, 700, 350)
    print(f"MISS {rid or text}", flush=True)
    return False


def screencap(serial: str, path: Path) -> None:
    data = adb_bytes(serial, "exec-out", "screencap", "-p")
    if not data.startswith(b"\x89PNG"):
        data = data.replace(b"\r\n", b"\n")
    path.write_bytes(data)
    print(f"CAPTURED {path.name} ({path.stat().st_size} bytes)", flush=True)


def geo(serial: str, steps: int = 12, speed_kn: float = 6.5) -> None:
    adb(serial, "shell", "settings", "put", "secure", "location_mode", "3", timeout=5)
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", timeout=5)
    lon, lat = 10.1680, 54.3550
    for i in range(steps):
        adb(
            serial,
            "emu",
            "geo",
            "fix",
            f"{lon + 0.00004 * i:.6f}",
            f"{lat + 0.000025 * i:.6f}",
            "3",
            "12",
            f"{speed_kn:.1f}",
            timeout=5,
        )
        time.sleep(0.55)


def fit_phone(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(TW / sw, TH / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TW) // 2
    top = max(0, nh - TH)  # bottom-anchor keeps CTA
    return im.crop((left, top, left + TW, top + TH))


def grant_loc(serial: str) -> None:
    for p in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
    ):
        adb(serial, "shell", "pm", "grant", PKG, p, timeout=5)


def onboarding_blind(serial: str, raw: Path) -> None:
    """Fixed taps — no dump wait (dumps hang during Expo boot)."""
    time.sleep(6)
    for _ in range(2):
        swipe(serial, 540, 700, 540, 1400, 250)
    time.sleep(0.3)
    screencap(serial, raw / "06-safety.png")
    tap(serial, 540, 1962, 1.0)  # I understand
    tap(serial, 540, 1595, 1.0)  # location continue
    tap(serial, 540, 1828, 0.9)  # allow location
    for _ in range(2):
        tap(serial, 540, 1350, 0.5)
        tap(serial, 270, 1450, 0.4)
    grant_loc(serial)
    tap(serial, 540, 1224, 0.9)  # battery
    tap(serial, 540, 1136, 1.3)  # finish
    for _ in range(3):
        tap(serial, 540, 1828, 0.4)
        tap(serial, 540, 1350, 0.4)
    grant_loc(serial)
    time.sleep(2.5)


def seed_passage(serial: str, locale: str) -> None:
    # Prefer reliable coords path (map long-press was flaky without HUD dumps)
    seed_passage_coords(serial, locale)
    # Verify we have a named passage; if still empty, try map planning once
    xml = dump(serial) or ""
    if "passage.empty" in xml or ("New passage" in xml and "Laboe" not in xml and PASSAGE_NAME not in xml):
        print("WARN coords weak — trying map planning", flush=True)
        tap(serial, 135, 2029, 0.6)
        geo(serial, steps=4)
        long_press(serial, 540, 950, 1200)
        tap_rid_or_text(serial, rid="map.longPress.startPassage", scrolls=0) or tap(
            serial, 540, 1480, 0.8
        )
        for x, y in ((360, 780), (740, 980), (480, 1120)):
            long_press(serial, x, y, 1100)
            time.sleep(0.5)
        tap_rid_or_text(serial, text="Activate", scrolls=1) or tap(serial, 540, 1750, 0.8)


def seal_kiel(serial: str, timeout: float = 600) -> bool:
    # More tab (⋯)
    tap(serial, 945, 2029, 0.6)
    time.sleep(0.4)
    # Open Offline charts / Downloads
    opened = (
        tap_rid_or_text(serial, rid="tab.downloads", scrolls=4)
        or tap_rid_or_text(serial, text="Offline charts", scrolls=4)
        or tap_rid_or_text(serial, text="Offline-Karten", scrolls=4)
        or tap_rid_or_text(serial, text="Offline", scrolls=3)
        or tap_rid_or_text(serial, text="Download", scrolls=3)
        or tap_rid_or_text(serial, text="Herunterladen", scrolls=3)
    )
    if not opened:
        # Blind: first list row under More often Downloads
        tap(serial, 540, 520, 0.8)
    time.sleep(1.0)
    xml = dump(serial)
    hit = find_tap(xml or "", rid="downloads.wifiOnly")
    if hit:
        tap(serial, hit[0], hit[1], 0.4)
    started = (
        tap_rid_or_text(serial, rid="downloads.download.kiel-bay", scrolls=10)
        or tap_rid_or_text(serial, text="Download pack", scrolls=8)
        or tap_rid_or_text(serial, text="Paket laden", scrolls=8)
    )
    if not started:
        print("FAIL start kiel download", flush=True)
        return False
    print("DOWNLOAD kiel-bay started", flush=True)
    end = time.time() + timeout
    while time.time() < end:
        xml = dump(serial) or ""
        empty = "No offline packs yet" in xml or "Noch keine Offline-Pakete" in xml
        ready = (
            (("Ready" in xml or "Bereit" in xml or "ready offline" in xml or "offline bereit" in xml) and not empty)
            or ("downloads.delete.kiel-bay" in xml)
            or ("1 chart pack ready" in xml)
            or ("1 Kartenpaket" in xml)
        )
        if ready:
            print("PACK sealed", flush=True)
            return True
        # Stay on downloads — dismiss map jump if download navigated away
        if "tab.map" in xml and "screen.downloads" not in xml and "Offline" not in xml:
            tap(serial, 945, 2029, 0.5)
            tap_rid_or_text(serial, text="Offline", scrolls=2)
        time.sleep(5)
    print("FAIL seal timeout", flush=True)
    return False


def seed_passage_coords(serial: str, locale: str) -> None:
    """Reliable ≥3-leg passage via coordinate sheet."""
    tap(serial, 405, 2029, 0.7)
    time.sleep(0.5)
    if not (tap_rid_or_text(serial, text="New passage", scrolls=2) or tap_rid_or_text(serial, text="Neue Passage", scrolls=2)):
        tap(serial, 540, 960, 0.8)
    time.sleep(0.7)
    for wp_name, lat, lon in WP:
        # Reveal add-by-coords (often below fold after first WP)
        for _ in range(3):
            swipe(serial, 540, 1500, 540, 700, 320)
        opened = tap_rid_or_text(serial, rid="passage.addByCoords", scrolls=2)
        if not opened:
            opened = tap_rid_or_text(serial, text="Add by coordinates", scrolls=2) or tap_rid_or_text(
                serial, text="Koordinaten", scrolls=2
            )
        if not opened:
            # Blind: blue add-coords CTA often mid-lower
            tap(serial, 540, 1513, 0.7)
        time.sleep(0.6)
        xml = dump(serial)
        edits = []
        for node in re.finditer(r"<node[^>]+>", xml or ""):
            n = node.group(0)
            if "EditText" not in n:
                continue
            b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
            if not b:
                continue
            x1, y1, x2, y2 = map(int, b.groups())
            edits.append(((x1 + x2) // 2, (y1 + y2) // 2, y1))
        edits.sort(key=lambda e: e[2])
        if len(edits) < 3:
            # Sheet missing — skip this WP attempt
            print(f"WP {wp_name} NO_SHEET", flush=True)
            adb(serial, "shell", "input", "keyevent", "4", timeout=4)
            continue
        for (x, y, _), val in zip(edits[:3], [wp_name, lat, lon]):
            tap(serial, x, y, 0.2)
            # clear lightly
            adb(serial, "shell", "input", "keyevent", "KEYCODE_MOVE_END", timeout=3)
            adb(serial, "shell", "input", "text", val.replace(" ", "%s"), timeout=8)
        # Save BEFORE back — Back closes the sheet
        saved = (
            tap_rid_or_text(serial, rid="passage.waypointCoord.save", scrolls=1)
            or tap_rid_or_text(serial, text="Add waypoint", scrolls=1)
            or tap_rid_or_text(serial, text="Wegpunkt hinzufügen", scrolls=1)
        )
        if not saved:
            tap(serial, 540, 1756, 0.7)
        print(f"WP {wp_name} saved={saved}", flush=True)
        time.sleep(0.45)
    # Scroll to top for rename
    for _ in range(3):
        swipe(serial, 540, 700, 540, 1500, 280)
    xml = dump(serial)
    edits = []
    for node in re.finditer(r"<node[^>]+>", xml or ""):
        n = node.group(0)
        if "EditText" not in n:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        if y1 > 900:
            continue
        edits.append(((x1 + x2) // 2, (y1 + y2) // 2, y1))
    edits.sort(key=lambda e: e[2])
    if edits:
        x, y, _ = edits[0]
        tap(serial, x, y, 0.3)
        for _ in range(22):
            adb(serial, "shell", "input", "keyevent", "67", timeout=3)
        adb(serial, "shell", "input", "text", PASSAGE_NAME.replace(" ", "%s"), timeout=8)
        adb(serial, "shell", "input", "keyevent", "66", timeout=4)
        tap_rid_or_text(serial, rid="passage.saveName", scrolls=1) or tap_rid_or_text(
            serial, text="Save name", scrolls=0
        ) or tap_rid_or_text(serial, text="Namen speichern", scrolls=0)
    for _ in range(2):
        swipe(serial, 540, 1500, 540, 700, 300)
    tap_rid_or_text(serial, rid="passage.detail.activate", scrolls=3) or tap_rid_or_text(
        serial, text="Activate", scrolls=2
    ) or tap_rid_or_text(serial, text="Aktivieren", scrolls=2)
    tap_rid_or_text(serial, rid="passage.preview.showOnMap", scrolls=1)


def run(locale: str, serial: str, apk: Path, out_docs: Path, fastlane_dest: Path) -> None:
    raw = out_docs / f"_raw-live-{locale}"
    raw.mkdir(parents=True, exist_ok=True)
    out_docs.mkdir(parents=True, exist_ok=True)
    fastlane_dest.mkdir(parents=True, exist_ok=True)

    print(f"==> Locale {locale} on {serial}", flush=True)
    lang = "de-DE" if locale.startswith("de") else "en-US"
    adb(serial, "shell", "settings", "put", "system", "system_locales", lang, timeout=8)
    adb(serial, "uninstall", PKG, timeout=30)
    adb(serial, "install", "-r", str(apk), check=True, timeout=120)
    adb(serial, "shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, timeout=8)
    adb(serial, "shell", "pm", "clear", PKG, timeout=15)
    adb(serial, "shell", "cmd", "locale", "set-app-locales", PKG, "--locales", lang, timeout=8)
    grant_loc(serial)
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", timeout=5)
    adb(serial, "shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", timeout=20)
    onboarding_blind(serial, raw)

    # #1 map hero
    tap(serial, 135, 2029, 0.5)
    geo(serial, steps=14)
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap(serial, x, y, 0.2)
    geo(serial, steps=6)
    time.sleep(1)
    screencap(serial, raw / "01-map-hero.png")

    seed_passage(serial, locale)
    tap(serial, 135, 2029, 0.6)
    geo(serial, steps=10)
    time.sleep(1.2)
    screencap(serial, raw / "02-map-passage.png")

    # #3 passage detail
    tap(serial, 405, 2029, 0.7)
    xml = dump(serial)
    m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml or "")
    if m:
        tap_rid_or_text(serial, rid=m.group(0).split('"')[1], scrolls=0)
    else:
        tap(serial, 540, 700, 0.7)
    time.sleep(0.5)
    swipe(serial, 540, 900, 540, 1400, 280)
    screencap(serial, raw / "03-passage-detail.png")

    # #4 downloads with sealed pack
    seal_kiel(serial, timeout=720)
    for _ in range(3):
        swipe(serial, 540, 700, 540, 1500, 280)
    time.sleep(0.4)
    screencap(serial, raw / "04-downloads.png")

    # #5 offline
    adb(serial, "shell", "cmd", "connectivity", "airplane-mode", "enable", timeout=8)
    time.sleep(1.2)
    tap(serial, 135, 2029, 0.8)
    time.sleep(2.5)
    screencap(serial, raw / "05-offline.png")
    adb(serial, "shell", "cmd", "connectivity", "airplane-mode", "disable", timeout=8)

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
        img = fit_phone(Image.open(src))
        docs_path = out_docs / f"{locale}-{docs_name}"
        img.save(docs_path, "PNG", optimize=True)
        if locale == "en-US":
            img.save(out_docs / docs_name, "PNG", optimize=True)
        fl_path = fastlane_dest / fl_name
        img.save(fl_path, "PNG", optimize=True)
        print(f"WROTE {docs_path.name} + {fl_path} {img.size}", flush=True)
    print("LOCALE_DONE", locale, flush=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--locale", required=True, choices=["en-US", "de-DE"])
    p.add_argument("--serial", required=True)
    p.add_argument("--apk", required=True)
    p.add_argument("--docs-out", required=True)
    p.add_argument("--fastlane-dir", required=True)
    args = p.parse_args()
    run(args.locale, args.serial, Path(args.apk), Path(args.docs_out), Path(args.fastlane_dir))


if __name__ == "__main__":
    main()
