#!/usr/bin/env python3
"""Capture Atlas R10 visual pack from sealed Ready state (honesty already on device)."""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "documentation/seacheck/qa-report/screenshots/android"
PKG = "de.softwarebydesign.seacheck"
SERIAL = open("/tmp/seacheck-avd.env").read().split("ANDROID_SERIAL=")[1].split()[0].strip()
OUT.mkdir(parents=True, exist_ok=True)

TAB = {"map": (135, 2030), "passage": (405, 2030), "tracks": (675, 2030), "more": (945, 2030)}


def sh(*a, timeout=60):
    return subprocess.run(["adb", "-s", SERIAL, *a], text=True, capture_output=True, timeout=timeout)


def tap(x, y, w=0.55):
    sh("shell", "input", "tap", str(x), str(y))
    time.sleep(w)


def swipe(x1, y1, x2, y2, d=280):
    sh("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(d))
    time.sleep(0.3)


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=90)
    return sh("shell", "cat", "/sdcard/ui.xml", timeout=30).stdout or ""


def find(xml, rid=None, text=None):
    if rid:
        m = re.search(rf'resource-id="{re.escape(rid)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml) or re.search(
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="{re.escape(rid)}"', xml
        )
    else:
        m = re.search(rf'text="[^"]*{re.escape(text)}[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml) or re.search(
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="[^"]*{re.escape(text)}[^"]*"', xml
        )
    if not m:
        return None
    l, t, r, b = map(int, m.groups())
    return ((l + r) // 2, (t + b) // 2)


def tap_rid(rid, scrolls=6):
    for _ in range(scrolls + 1):
        xml = dump()
        hit = find(xml, rid=rid)
        if hit:
            print(f"TAP {rid} @{hit}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 800)
    print(f"MISS {rid}", flush=True)
    return False


def tap_text(s, scrolls=6):
    for _ in range(scrolls + 1):
        xml = dump()
        hit = find(xml, text=s)
        if hit:
            print(f"TAP text:{s} @{hit}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 800)
    print(f"MISS text:{s}", flush=True)
    return False


def screencap(name: str) -> Path:
    path = OUT / name
    sh("shell", "screencap", "-p", "/sdcard/atlas-cap.png")
    sh("pull", "/sdcard/atlas-cap.png", str(path))
    print(f"CAPTURED {name} {path.stat().st_size}", flush=True)
    return path


def md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def geo(steps=10):
    lon, lat = 10.1680, 54.3550
    for i in range(steps):
        sh("emu", "geo", "fix", f"{lon+0.00004*i:.6f}", f"{lat+0.000025*i:.6f}", "3", "12", "6.5")
        time.sleep(0.5)


def set_locale(loc: str):
    sh("shell", "am", "force-stop", PKG)
    sh("shell", "settings", "put", "system", "system_locales", loc)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", loc)
    for p in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
        sh("shell", "pm", "grant", PKG, f"android.permission.{p}")
    sh("shell", "am", "start", "-n", f"{PKG}/.MainActivity")
    time.sleep(3.5)


def open_downloads():
    tap(*TAB["more"])
    time.sleep(0.6)
    tap_rid("tab.downloads") or tap_text("Downloads")
    time.sleep(1.0)
    for _ in range(3):
        swipe(540, 700, 540, 1500)  # top — Ready banner
    time.sleep(0.4)


def open_settings():
    tap(*TAB["more"])
    time.sleep(0.5)
    tap_rid("tab.settings") or tap_text("Settings") or tap_text("Einstellungen")
    time.sleep(0.8)
    for _ in range(6):
        swipe(540, 1600, 540, 700)
    time.sleep(0.4)


def dismiss_tip():
    xml = dump()
    hit = find(xml, rid="map.topAlert.dismiss")
    if hit:
        tap(*hit, w=0.4)
        return
    for xy in ((1000, 170), (1020, 190)):
        tap(*xy, w=0.2)


def seed_sample():
    tap(*TAB["passage"])
    time.sleep(0.9)
    xml = dump()
    if "Add sample" in xml or "Beispiel" in xml or 'passage.empty' in xml:
        tap_text("Add sample") or tap_text("Beispiel")
        time.sleep(1.2)
    else:
        m = re.search(r'resource-id="(passage\.card\.open\.[^"]+)"', xml)
        if m:
            tap_rid(m.group(1), scrolls=1)
            time.sleep(0.8)
    tap_rid("passage.detail.activate") or tap_text("Activate") or tap_text("Aktivieren")
    time.sleep(0.8)
    xml = dump()
    if "confirm.proceed" in xml:
        tap_rid("confirm.proceed")
        time.sleep(0.5)
    tap(*TAB["map"])
    time.sleep(1.5)


def main():
    hashes = {}

    # --- DE Ready first (device already DE + Ready honesty) ---
    print("=== DE Ready ===", flush=True)
    set_locale("de-DE")
    geo(6)
    dismiss_tip()
    p = screencap("atlas-visual-r10-android-de-map.png")
    hashes[p.name] = md5(p)

    open_downloads()
    # Scroll so Kieler Bucht pack identity is in fold under Ready
    for _ in range(2):
        swipe(540, 1400, 540, 900)
    time.sleep(0.4)
    # Prefer seeing Ready + Kieler — scroll up if we overshot
    xml = dump()
    if "Kartenpaket offline bereit" not in xml and "offline bereit" not in xml:
        for _ in range(4):
            swipe(540, 700, 540, 1500)
    p = screencap("atlas-visual-r10-android-de-downloads-ready.png")
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready-de.png")

    # --- EN ---
    print("=== EN ===", flush=True)
    set_locale("en-US")
    geo(12)
    dismiss_tip()
    p = screencap("atlas-visual-r10-android-en-map.png")
    hashes[p.name] = md5(p)

    seed_sample()
    geo(8)
    dismiss_tip()
    time.sleep(0.8)
    xml = dump()
    print(
        f"passageHUD={'map.passageInstrument' in xml or 'map.passageNavHero' in xml}",
        flush=True,
    )
    p = screencap("atlas-visual-r10-android-en-passage.png")
    hashes[p.name] = md5(p)

    tap(*TAB["more"])
    time.sleep(0.7)
    p = screencap("atlas-visual-r10-android-en-more.png")
    hashes[p.name] = md5(p)

    open_settings()
    p = screencap("atlas-visual-r10-android-en-settings.png")
    hashes[p.name] = md5(p)

    sh("shell", "input", "keyevent", "4")
    time.sleep(0.3)
    open_downloads()
    for _ in range(2):
        swipe(540, 1400, 540, 900)
    time.sleep(0.3)
    xml = dump()
    if "chart pack ready" not in xml.lower() and "ready offline" not in xml.lower():
        for _ in range(4):
            swipe(540, 700, 540, 1500)
    p = screencap("atlas-visual-r10-android-en-downloads.png")
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready.png")

    for n, d in hashes.items():
        print(f"MD5 {n} {d}", flush=True)
    same = md5(OUT / "atlas-visual-r10-android-en-passage.png") == md5(OUT / "atlas-visual-r10-android-en-more.png")
    print(f"passage_vs_more_same={same}", flush=True)

    # Quick text probes
    for shot in (
        "atlas-visual-r10-android-en-downloads.png",
        "atlas-r10-download-seal-ready-de.png",
        "atlas-visual-r10-android-en-settings.png",
    ):
        print(f"exists {shot} { (OUT/shot).exists() }", flush=True)


if __name__ == "__main__":
    main()
