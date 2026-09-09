#!/usr/bin/env python3
"""Atlas polish r1 visual pack — DE title, More chrome, CTA pad, cancel empty."""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "documentation/seacheck/qa-report/screenshots/android"
PKG = "de.softwarebydesign.seacheck"
SERIAL = os.environ.get("ANDROID_SERIAL") or (sys.argv[1] if len(sys.argv) > 1 else "emulator-5602")
ADB = os.environ.get("ADB_BIN", "/home/alex/Android/Sdk/platform-tools/adb")

TAB = {"map": (135, 2030), "passage": (405, 2030), "tracks": (675, 2030), "more": (945, 2030)}


def sh(*args: str, check: bool = False, timeout: int = 90) -> subprocess.CompletedProcess[str]:
    return subprocess.run([ADB, "-s", SERIAL, *args], check=check, text=True, capture_output=True, timeout=timeout)


def tap(x: int, y: int, wait: float = 0.55) -> None:
    sh("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def swipe(x1: int, y1: int, x2: int, y2: int, dur: int = 280) -> None:
    sh("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(dur))
    time.sleep(0.3)


def dump_xml() -> str:
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=90)
    return sh("shell", "cat", "/sdcard/ui.xml", timeout=30).stdout or ""


def has(xml: str, rid: str) -> bool:
    return f'resource-id="{rid}"' in xml


def find_center(xml: str, *, rid: str | None = None, text: str | None = None) -> tuple[int, int] | None:
    if rid:
        m = re.search(rf'resource-id="{re.escape(rid)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml) or re.search(
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="{re.escape(rid)}"', xml
        )
    else:
        assert text is not None
        m = re.search(rf'text="[^"]*{re.escape(text)}[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml) or re.search(
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="[^"]*{re.escape(text)}[^"]*"', xml
        )
    if not m:
        return None
    l, t, r, b = map(int, m.groups())
    return ((l + r) // 2, (t + b) // 2)


def tap_rid(rid: str, scrolls: int = 5) -> bool:
    for _ in range(scrolls + 1):
        xml = dump_xml()
        hit = find_center(xml, rid=rid)
        if hit:
            print(f"TAP {rid} @{hit}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 800)
    print(f"MISS {rid}", flush=True)
    return False


def tap_text(substr: str, scrolls: int = 5) -> bool:
    for _ in range(scrolls + 1):
        xml = dump_xml()
        hit = find_center(xml, text=substr)
        if hit:
            print(f"TAP text:{substr} @{hit}", flush=True)
            tap(*hit)
            return True
        swipe(540, 1500, 540, 800)
    print(f"MISS text:{substr}", flush=True)
    return False


def screencap(name: str) -> Path:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    sh("shell", "screencap", "-p", "/sdcard/atlas-cap.png", timeout=30)
    sh("pull", "/sdcard/atlas-cap.png", str(path), timeout=30)
    print(f"CAPTURED {name} ({path.stat().st_size})", flush=True)
    return path


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def geo(steps: int = 10) -> None:
    lon, lat = 10.1680, 54.3550
    for i in range(steps):
        sh("emu", "geo", "fix", f"{lon + 0.00004 * i:.6f}", f"{lat + 0.000025 * i:.6f}", "3", "12", "6.5")
        time.sleep(0.45)


def set_locale(loc: str) -> None:
    sh("shell", "am", "force-stop", PKG)
    sh("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", loc)
    for p in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
        sh("shell", "pm", "grant", PKG, f"android.permission.{p}")
    sh("shell", "am", "start", "-n", f"{PKG}/.MainActivity")
    time.sleep(3.8)
    xml = dump_xml()
    for rid in (
        "onboarding.disclaimer.continue",
        "onboarding.location.continue",
        "onboarding.battery.ack",
        "onboarding.finish",
    ):
        if has(xml, rid):
            tap_rid(rid, scrolls=1)
            time.sleep(0.45)
            xml = dump_xml()


def dismiss_tip() -> None:
    xml = dump_xml()
    hit = find_center(xml, rid="map.topAlert.dismiss")
    if hit:
        tap(*hit, wait=0.35)
        return
    for xy in ((1000, 170), (1020, 190), (980, 150)):
        tap(*xy, wait=0.15)


def seed_sample() -> None:
    tap(*TAB["passage"])
    time.sleep(0.9)
    xml = dump_xml()
    if "Add sample" in xml or "Beispiel" in xml or "passage.empty" in xml:
        tap_text("Add sample") or tap_text("Beispiel") or tap_rid("passage.addSample")
        time.sleep(1.2)
    else:
        m = re.search(r'resource-id="(passage\.card\.open\.[^"]+)"', xml)
        if m:
            tap_rid(m.group(1), scrolls=1)
            time.sleep(0.8)
    tap_rid("passage.detail.activate") or tap_text("Activate") or tap_text("Aktivieren")
    time.sleep(0.8)
    xml = dump_xml()
    if has(xml, "confirm.proceed"):
        tap_rid("confirm.proceed")
        time.sleep(0.5)
    tap(*TAB["map"])
    time.sleep(1.4)


def start_planning_from_map() -> None:
    """Long-press chart → start new passage (stores defaultName in current locale)."""
    tap(*TAB["map"])
    time.sleep(0.8)
    # Long-press center of chart
    sh("shell", "input", "swipe", "540", "900", "540", "900", "1200")
    time.sleep(1.0)
    xml = dump_xml()
    if not (
        tap_text("New passage")
        or tap_text("Neue Passage")
        or tap_text("Start")
        or tap_rid("map.context.startPassage")
        or tap_text("passage")
    ):
        # Fallback: Passage tab create
        tap(*TAB["passage"])
        time.sleep(0.7)
        tap_rid("passage.create") or tap_text("New passage") or tap_text("Neue Passage")
        time.sleep(0.8)
        tap_rid("passage.preview.showOnMap") or tap_text("Show on map") or tap_text("Auf Karte")
        time.sleep(0.6)
        tap(*TAB["map"])
        time.sleep(1.0)
    time.sleep(0.8)


def open_more() -> None:
    tap(*TAB["more"])
    time.sleep(0.7)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}

    print("=== EN map / passage / more ===", flush=True)
    set_locale("en-US")
    geo(12)
    dismiss_tip()
    p = screencap("atlas-visual-r10-android-en-map.png")
    hashes[p.name] = md5(p)

    seed_sample()
    geo(8)
    dismiss_tip()
    time.sleep(0.7)
    xml = dump_xml()
    print(f"passageHUD={has(xml, 'map.passageInstrument') or has(xml, 'map.passageNavHero')}", flush=True)
    p = screencap("atlas-visual-r10-android-en-passage.png")
    hashes[p.name] = md5(p)

    # More over live passage — should not stack planning coachmark+tip
    open_more()
    p = screencap("atlas-visual-r10-android-en-more.png")
    hashes[p.name] = md5(p)

    # Settings (About fold)
    tap_rid("tab.settings") or tap_text("Settings")
    time.sleep(0.8)
    for _ in range(6):
        swipe(540, 1600, 540, 700)
    time.sleep(0.35)
    p = screencap("atlas-visual-r10-android-en-settings.png")
    hashes[p.name] = md5(p)

    sh("shell", "input", "keyevent", "4")
    time.sleep(0.3)
    open_more()
    tap_rid("tab.downloads") or tap_text("Downloads")
    time.sleep(1.0)
    for _ in range(3):
        swipe(540, 700, 540, 1500)
    time.sleep(0.4)
    p = screencap("atlas-visual-r10-android-en-downloads.png")
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready.png")

    # --- DE planner title (EN-bleed stock name → Neue Passage) ---
    print("=== DE planner title ===", flush=True)
    set_locale("en-US")
    start_planning_from_map()
    # Force stored EN default if create path used DE somehow — rename not needed;
    # displayPassageName remaps any locale default.
    set_locale("de-DE")
    tap(*TAB["map"])
    time.sleep(1.2)
    # Re-enter planning if lost across locale restart
    xml = dump_xml()
    if not has(xml, "passage.mapPlanning.panel"):
        start_planning_from_map()
        time.sleep(0.8)
        xml = dump_xml()
    dismiss_tip()
    print(
        f"de_panel={has(xml, 'passage.mapPlanning.panel')} "
        f"has_Neue={'Neue Passage' in dump_xml()} has_NewEN={'New passage' in dump_xml()}",
        flush=True,
    )
    p = screencap("atlas-visual-r10-android-de-map.png")
    hashes[p.name] = md5(p)

    open_more()
    tap_rid("tab.downloads") or tap_text("Downloads") or tap_text("Offline")
    time.sleep(1.0)
    for _ in range(3):
        swipe(540, 700, 540, 1500)
    time.sleep(0.4)
    p = screencap("atlas-visual-r10-android-de-downloads-ready.png")
    hashes[p.name] = md5(p)
    shutil.copyfile(p, OUT / "atlas-r10-download-seal-ready-de.png")

    for name, digest in hashes.items():
        print(f"MD5 {name} {digest}", flush=True)
    same = md5(OUT / "atlas-visual-r10-android-en-passage.png") == md5(OUT / "atlas-visual-r10-android-en-more.png")
    print(f"passage_vs_more_same={same}", flush=True)


if __name__ == "__main__":
    main()
