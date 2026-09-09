#!/usr/bin/env python3
"""Atlas R10 visual pack — lean capture (fixed taps; Add sample passage)."""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "documentation/seacheck/qa-report/screenshots/android"
PKG = "de.softwarebydesign.seacheck"
SERIAL = sys.argv[1] if len(sys.argv) > 1 else "emulator-5602"

# Pixel 3-ish from prior dump (1080x2160 / 1080x2220 chrome)
TAB = {
    "map": (135, 2030),
    "passage": (405, 2030),
    "tracks": (675, 2030),
    "more": (945, 2030),
}


def sh(*args: str, check: bool = False, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["adb", "-s", SERIAL, *args],
        check=check,
        text=True,
        capture_output=True,
        timeout=timeout,
    )


def tap(x: int, y: int, wait: float = 0.6) -> None:
    sh("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def swipe(x1: int, y1: int, x2: int, y2: int, dur: int = 280) -> None:
    sh("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(dur))
    time.sleep(0.35)


def dump_xml() -> str:
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=90)
    p = sh("shell", "cat", "/sdcard/ui.xml", timeout=30)
    return p.stdout or ""


def has(xml: str, rid: str) -> bool:
    return f'resource-id="{rid}"' in xml or f'resource-id=\\"{rid}\\"' in xml


def find_center(xml: str, *, rid: str | None = None, text: str | None = None) -> tuple[int, int] | None:
    # Prefer resource-id; fallback text contains
    pattern = None
    if rid:
        pattern = rf'resource-id="{re.escape(rid)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
        m = re.search(pattern, xml)
        if not m:
            pattern = rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="{re.escape(rid)}"'
            m = re.search(pattern, xml)
    elif text:
        pattern = rf'text="[^"]*{re.escape(text)}[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
        m = re.search(pattern, xml)
        if not m:
            pattern = rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="[^"]*{re.escape(text)}[^"]*"'
            m = re.search(pattern, xml)
    else:
        return None
    if not m:
        return None
    l, t, r, b = map(int, m.groups())
    return ((l + r) // 2, (t + b) // 2)


def tap_rid(rid: str, scrolls: int = 4) -> bool:
    for _ in range(scrolls + 1):
        xml = dump_xml()
        hit = find_center(xml, rid=rid)
        if hit:
            print(f"TAP {rid} @{hit[0]},{hit[1]}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 900)
    print(f"MISS {rid}", flush=True)
    return False


def tap_text(substr: str, scrolls: int = 4) -> bool:
    for _ in range(scrolls + 1):
        xml = dump_xml()
        hit = find_center(xml, text=substr)
        if hit:
            print(f"TAP text:{substr} @{hit[0]},{hit[1]}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 900)
    print(f"MISS text:{substr}", flush=True)
    return False


def screencap(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sh("shell", "screencap", "-p", "/sdcard/atlas-cap.png", timeout=30)
    sh("pull", "/sdcard/atlas-cap.png", str(path), timeout=30)
    print(f"CAPTURED {path.name} ({path.stat().st_size} bytes)", flush=True)


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def geo_fix(steps: int = 12) -> None:
    lon, lat = 10.1680, 54.3550
    for i in range(steps):
        sh(
            "emu",
            "geo",
            "fix",
            f"{lon + 0.00004 * i:.6f}",
            f"{lat + 0.000025 * i:.6f}",
            "3",
            "12",
            "6.5",
        )
        time.sleep(0.55)


def dismiss_tip() -> None:
    xml = dump_xml()
    hit = find_center(xml, rid="map.topAlert.dismiss")
    if hit:
        tap(*hit, wait=0.4)
        return
    # Fallback X near top-right of tip
    for xy in ((1000, 170), (1020, 190), (980, 150)):
        tap(*xy, wait=0.25)


def set_app_locale(locale: str) -> None:
    """Best-effort: app locales API + relaunch."""
    sh("shell", "am", "force-stop", PKG)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, locale)
    # Also try Settings storage via broadcast is unavailable — in-app Display language if needed
    sh("shell", "am", "start", "-n", f"{PKG}/.MainActivity")
    time.sleep(3.5)
    # Grant location
    for perm in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
    ):
        sh("shell", "pm", "grant", PKG, perm)
    # Skip onboarding if present
    xml = dump_xml()
    for rid in (
        "onboarding.disclaimer.continue",
        "onboarding.location.continue",
        "onboarding.battery.ack",
        "onboarding.finish",
    ):
        if has(xml, rid):
            tap_rid(rid, scrolls=1)
            time.sleep(0.5)
            xml = dump_xml()


def open_settings_language_en() -> None:
    """If still DE, flip language in Settings → Display."""
    tap(*TAB["more"])
    time.sleep(0.5)
    tap_rid("tab.settings") or tap_text("Settings") or tap_text("Einstellungen")
    time.sleep(0.7)
    tap_rid("settings.menu.display") or tap_text("Display") or tap_text("Anzeige")
    time.sleep(0.6)
    # Language row — tap English if visible
    if not (tap_text("English") or tap_text("Englisch") or tap_text("Language") or tap_text("Sprache")):
        return
    time.sleep(0.5)
    tap_text("English") or tap_text("en")
    time.sleep(1.0)
    sh("shell", "input", "keyevent", "4")
    time.sleep(0.3)
    sh("shell", "input", "keyevent", "4")
    time.sleep(0.3)


def seed_sample_passage() -> None:
    tap(*TAB["passage"])
    time.sleep(0.8)
    xml = dump_xml()
    # Empty → add sample; else open first card / already have Kiel
    if has(xml, "passage.empty") or "Add sample" in xml or "Beispiel" in xml:
        tap_text("Add sample") or tap_text("Beispiel") or tap_rid("passage.addSample")
        time.sleep(1.2)
    else:
        m = re.search(r'resource-id="(passage\.card\.open\.[^"]+)"', xml)
        if m:
            tap_rid(m.group(1), scrolls=1)
            time.sleep(0.8)

    # Activate if button present
    xml = dump_xml()
    if has(xml, "passage.detail.activate") or "Activate" in xml or "Aktivieren" in xml:
        tap_rid("passage.detail.activate") or tap_text("Activate") or tap_text("Aktivieren")
        time.sleep(1.0)
        # Confirm sheet
        xml = dump_xml()
        if has(xml, "confirm.proceed"):
            tap_rid("confirm.proceed")
            time.sleep(0.6)

    # Show on map
    tap_rid("passage.preview.showOnMap") or tap_text("Show on map") or tap_text("Auf Karte")
    time.sleep(0.5)
    tap(*TAB["map"])
    time.sleep(1.5)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}

    # --- EN pack ---
    print("=== EN ===", flush=True)
    set_app_locale("en-US")
    open_settings_language_en()
    tap(*TAB["map"])
    time.sleep(1)
    geo_fix(14)
    dismiss_tip()
    time.sleep(0.5)
    p = OUT / "atlas-visual-r10-android-en-map.png"
    screencap(p)
    hashes[p.name] = md5(p)

    seed_sample_passage()
    geo_fix(10)
    dismiss_tip()
    time.sleep(0.8)
    # Prefer active passage HUD presence
    xml = dump_xml()
    print(
        f"passageHUD={has(xml, 'map.passageInstrument') or has(xml, 'map.passageNavHero')}",
        flush=True,
    )
    p = OUT / "atlas-visual-r10-android-en-passage.png"
    screencap(p)
    hashes[p.name] = md5(p)

    tap(*TAB["more"])
    time.sleep(0.7)
    p = OUT / "atlas-visual-r10-android-en-more.png"
    screencap(p)
    hashes[p.name] = md5(p)

    tap_rid("tab.settings") or tap_text("Settings") or tap_text("Einstellungen")
    time.sleep(0.8)
    for _ in range(5):
        swipe(540, 1600, 540, 700)
    time.sleep(0.4)
    p = OUT / "atlas-visual-r10-android-en-settings.png"
    screencap(p)
    hashes[p.name] = md5(p)

    # Downloads via More sheet
    sh("shell", "input", "keyevent", "4")
    time.sleep(0.4)
    tap(*TAB["more"])
    time.sleep(0.5)
    tap_rid("tab.downloads") or tap_text("Downloads") or tap_text("Offline")
    time.sleep(1.0)
    for _ in range(3):
        swipe(540, 700, 540, 1500)  # to top
    time.sleep(0.5)
    p = OUT / "atlas-visual-r10-android-en-downloads.png"
    screencap(p)
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready.png")

    # --- DE pack ---
    print("=== DE ===", flush=True)
    set_app_locale("de-DE")
    tap(*TAB["map"])
    time.sleep(1)
    geo_fix(8)
    dismiss_tip()
    p = OUT / "atlas-visual-r10-android-de-map.png"
    screencap(p)
    hashes[p.name] = md5(p)

    tap(*TAB["more"])
    time.sleep(0.5)
    tap_rid("tab.downloads") or tap_text("Downloads")
    time.sleep(1.0)
    for _ in range(3):
        swipe(540, 700, 540, 1500)
    time.sleep(0.5)
    p = OUT / "atlas-visual-r10-android-de-downloads-ready.png"
    screencap(p)
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready-de.png")

    for name, digest in hashes.items():
        print(f"MD5 {name} {digest}", flush=True)
    same = md5(OUT / "atlas-visual-r10-android-en-passage.png") == md5(
        OUT / "atlas-visual-r10-android-en-more.png"
    )
    print(f"passage_vs_more_same={same}", flush=True)


if __name__ == "__main__":
    main()
