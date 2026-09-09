#!/usr/bin/env python3
"""SeaCheck Play Store phone capture — one locale per run (en-US or de-DE).

Shot list (store-farm/seacheck-play-shot-list.md):
  1 map hero + live GPS
  2 map + active passage
  3 passage detail (≥2 WPs)
  4 downloads
  5 offline map (or tracks)
  6 safety notice (full disclaimer)
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

# Kiel / Förde coastal demo — real coastal labels (≥3 legs)
PASSAGE_NAME_EN = "Kieler Foerde Laboe"
PASSAGE_NAME_DE = "Kieler Foerde Laboe"
WP = [
    ("Laboe", "54.4000", "10.2200"),
    ("Friedrichsort", "54.3900", "10.1850"),
    ("Holtenau", "54.3680", "10.1520"),
    ("Kiel Marina", "54.3230", "10.1860"),
]


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
    adb(serial, "shell", "rm", "-f", "/sdcard/sc-cap.xml", check=False, timeout=5)
    # --compressed is faster/less likely to wedge on dense map views
    r = adb(
        serial,
        "shell",
        "uiautomator",
        "dump",
        "--compressed",
        "/sdcard/sc-cap.xml",
        check=False,
        timeout=12,
    )
    if r.returncode != 0:
        r = adb(
            serial,
            "shell",
            "uiautomator",
            "dump",
            "/sdcard/sc-cap.xml",
            check=False,
            timeout=10,
        )
    if r.returncode != 0:
        print("WARN uiautomator dump failed", flush=True)
        return ""
    out = adb(serial, "shell", "cat", "/sdcard/sc-cap.xml", check=False, timeout=8)
    return out.stdout or ""


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


def geo_fix(serial: str, *, steps: int = 16, settle: bool = True, speed_kn: float = 6.5) -> None:
    """Inject mid-Förde GPS with velocity so SOG/COG populate without Jump-filtered jumps.

    Emulator: `geo fix <lon> <lat> [<alt> [<sats> [<velocity_kn>]]]`.
    Stay on open water (avoids black OSM pier scribble near ZMT).
    """
    adb(serial, "shell", "settings", "put", "secure", "location_mode", "3", check=False)
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", check=False)
    lon, lat = 10.1680, 54.3550
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


def long_press(serial: str, x: int, y: int, ms: int = 1200) -> None:
    adb(
        serial,
        "shell",
        "input",
        "swipe",
        str(x),
        str(y),
        str(x),
        str(y),
        str(ms),
        check=False,
    )
    time.sleep(1.0)


def fill_field_by_a11y(serial: str, label: str, value: str) -> bool:
    xml = dump(serial)
    # Prefer EditText with matching content-desc
    for node in re.finditer(r"<node[^>]+>", xml):
        n = node.group(0)
        if f'content-desc="{label}"' not in n:
            continue
        if "EditText" not in n:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        tap_xy(serial, (x1 + x2) // 2, (y1 + y2) // 2)
        # Clear field quickly then type
        adb(serial, "shell", "input", "keyevent", "KEYCODE_MOVE_END", check=False)
        adb(serial, "shell", "input", "keyevent", "--longpress", "KEYCODE_DEL", check=False)
        for _ in range(20):
            adb(serial, "shell", "input", "keyevent", "67", check=False)
        adb(serial, "shell", "input", "text", value.replace(" ", "%s"), check=False)
        time.sleep(0.2)
        return True
    hit = find_bounds(xml, text_exact=label)
    if hit:
        tap_xy(serial, hit[0], hit[1] + 80)
        adb(serial, "shell", "input", "text", value.replace(" ", "%s"), check=False)
        return True
    return False


def fill_edittexts_in_order(serial: str, values: list[str]) -> int:
    """Fill successive EditTexts on the current sheet (fast waypoint coords)."""
    xml = dump(serial)
    edits = []
    for node in re.finditer(r"<node[^>]+>", xml):
        n = node.group(0)
        if "EditText" not in n:
            continue
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if not b:
            continue
        x1, y1, x2, y2 = map(int, b.groups())
        edits.append(((x1 + x2) // 2, (y1 + y2) // 2, y1))
    edits.sort(key=lambda e: e[2])
    filled = 0
    for (x, y, _), val in zip(edits, values):
        tap_xy(serial, x, y)
        # One shot clear: Ctrl-A isn't available; triple-tap select then type over
        adb(serial, "shell", "input", "keyevent", "KEYCODE_MOVE_END", check=False)
        adb(
            serial,
            "shell",
            "input",
            "keyevent",
            "KEYCODE_MOVE_HOME",
            "KEYCODE_SHIFT_LEFT",
            "KEYCODE_MOVE_END",
            check=False,
        )
        adb(serial, "shell", "input", "text", val.replace(" ", "%s"), check=False)
        filled += 1
        time.sleep(0.12)
    return filled


def add_waypoint_coords(serial: str, name: str, lat: str, lon: str, locale: str) -> bool:
    if not ensure_tap(serial, "passage.addByCoords", scrolls=5):
        return False
    time.sleep(0.5)
    end = time.time() + 8
    while time.time() < end:
        if has_rid(dump(serial), "passage.waypointCoordSheet"):
            break
        time.sleep(0.25)
    n = fill_edittexts_in_order(serial, [name, lat, lon])
    if n < 3:
        name_lab = "Name"
        lat_lab = "Latitude (decimal degrees)" if locale.startswith("en") else "Breite (Dezimalgrad)"
        lon_lab = "Longitude (decimal degrees)" if locale.startswith("en") else "Länge (Dezimalgrad)"
        for lab, val in ((name_lab, name), (lat_lab, lat), (lon_lab, lon)):
            fill_field_by_a11y(serial, lab, val)
    adb(serial, "shell", "input", "keyevent", "4", check=False)
    time.sleep(0.2)
    return ensure_tap(serial, "passage.waypointCoord.save", scrolls=3) or ensure_tap(
        serial, text_substr="Add waypoint", scrolls=2
    ) or ensure_tap(serial, text_substr="Wegpunkt hinzufügen", scrolls=2)


def rename_passage(serial: str, locale: str) -> None:
    name = PASSAGE_NAME_DE if locale.startswith("de") else PASSAGE_NAME_EN
    xml = dump(serial)
    if not has_rid(xml, "passage.meta"):
        ensure_tap(serial, "tab.passage", scrolls=2)
        time.sleep(0.5)
        xml = dump(serial)
        m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml) or re.search(
            r'resource-id="passage\.card\.[^"]+"', xml
        )
        if m:
            ensure_tap(serial, m.group(0).split('"')[1], scrolls=2)
            time.sleep(0.7)
    for lab in ("Passage name", "Passagename"):
        if fill_field_by_a11y(serial, lab, name):
            break
    else:
        fill_edittexts_in_order(serial, [name])
    adb(serial, "shell", "input", "keyevent", "66", check=False)
    time.sleep(0.25)
    ensure_tap(serial, "passage.saveName", scrolls=2) or ensure_tap(
        serial, text_substr="Save name", scrolls=1
    ) or ensure_tap(serial, text_substr="Namen speichern", scrolls=1)
    time.sleep(0.3)


def seed_passage(serial: str, locale: str) -> None:
    """Map long-press planning (≥3 WPs) with minimal dumps (dump hangs on MapLibre)."""
    ensure_tap(serial, "tab.map", scrolls=1)
    time.sleep(0.6)
    geo_fix(serial, steps=5)
    # Dismiss banner via fixed taps — avoid dump on map chrome
    for x, y in ((1000, 180), (980, 160), (1020, 200)):
        tap_xy(serial, x, y)

    long_press(serial, 540, 950, 1200)
    time.sleep(0.6)
    started = (
        ensure_tap(serial, "map.longPress.startPassage", scrolls=1)
        or ensure_tap(serial, text_substr="Start new passage", scrolls=1)
        or ensure_tap(serial, text_substr="Neue Passage hier", scrolls=1)
    )
    if started:
        time.sleep(0.8)
        for x, y in ((360, 780), (740, 980), (480, 1120), (620, 860)):
            long_press(serial, x, y, 1100)
            time.sleep(0.55)
            # Dismiss accidental sheets without dump storms
            adb(serial, "shell", "input", "keyevent", "4", check=False, timeout=5)
            time.sleep(0.2)
        time.sleep(0.4)
        activated = (
            ensure_tap(serial, "passage.mapPlanning.activate", scrolls=2)
            or ensure_tap(serial, text_substr="Activate passage", scrolls=2)
            or ensure_tap(serial, text_substr="Activate", scrolls=2)
            or ensure_tap(serial, text_substr="Aktivieren", scrolls=2)
        )
        if not activated:
            ensure_tap(serial, "passage.mapPlanning.openPassage", scrolls=2)
            time.sleep(0.7)
            rename_passage(serial, locale)
            ensure_tap(serial, "passage.detail.activate", scrolls=4) or ensure_tap(
                serial, text_substr="Activate", scrolls=3
            )
        else:
            time.sleep(0.3)
            ensure_tap(serial, "passage.mapPlanning.done", scrolls=1) or ensure_tap(
                serial, text_substr="Done", scrolls=1
            ) or ensure_tap(serial, text_substr="Fertig", scrolls=1)
            ensure_tap(serial, "tab.passage", scrolls=1)
            time.sleep(0.5)
            xml = dump(serial)
            m = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml) or re.search(
                r'resource-id="passage\.card\.[^"]+"', xml
            )
            if m:
                ensure_tap(serial, m.group(0).split('"')[1], scrolls=1)
                time.sleep(0.6)
            rename_passage(serial, locale)
            ensure_tap(serial, "passage.preview.showOnMap", scrolls=1) or ensure_tap(
                serial, "passage.planOnMap", scrolls=1
            )
        return

    print("WARN map planning failed — coords fallback", flush=True)
    ensure_tap(serial, "tab.passage", scrolls=1)
    time.sleep(0.6)
    ensure_tap(serial, text_substr="New passage", scrolls=2) or ensure_tap(
        serial, text_substr="Neue Passage", scrolls=2
    )
    time.sleep(0.7)
    for wp_name, lat, lon in WP[:4]:
        ok = add_waypoint_coords(serial, wp_name, lat, lon, locale)
        print(f"WP {wp_name} ok={ok}", flush=True)
        time.sleep(0.25)
    rename_passage(serial, locale)
    ensure_tap(serial, "passage.detail.activate", scrolls=4) or ensure_tap(
        serial, text_substr="Activate", scrolls=3
    )
    time.sleep(0.4)
    ensure_tap(serial, "passage.preview.showOnMap", scrolls=1)


def seal_region_pack(serial: str, locale: str, pack_id: str = "kiel-bay", timeout: float = 600) -> bool:
    """Download + seal one corridor pack so #4 does not lead with empty-state."""
    ensure_tap(serial, "tab.more", scrolls=1)
    time.sleep(0.4)
    ensure_tap(serial, "tab.downloads", scrolls=3) or ensure_tap(
        serial, text_substr="Download", scrolls=3
    ) or ensure_tap(serial, text_substr="Herunterladen", scrolls=3) or ensure_tap(
        serial, text_substr="Offline", scrolls=3
    )
    time.sleep(1.5)
    # Wi-Fi only may block — allow cellular for emulator
    xml = dump(serial)
    if "downloads.wifiOnly" in xml or "Wi-Fi" in xml or "WLAN" in xml:
        hit = find_bounds(xml, rid="downloads.wifiOnly")
        if hit:
            # Toggle off if switch looks checked — tap once
            tap_xy(serial, hit[0], hit[1])
            time.sleep(0.5)
    rid = f"downloads.download.{pack_id}"
    started = ensure_tap(serial, rid, scrolls=10) or ensure_tap(
        serial, text_substr="Download pack", scrolls=6
    ) or ensure_tap(serial, text_substr="Paket laden", scrolls=6)
    if not started:
        print("FAIL could not start pack download", flush=True)
        return False
    print(f"DOWNLOAD started {pack_id}", flush=True)
    end = time.time() + timeout
    while time.time() < end:
        xml = dump(serial)
        ready_markers = (
            "statusSummaryReady",
            "chart pack ready",
            "Paket offline bereit",
            "Ready for offline",
            "Bereit für Offline",
            "1 chart pack ready",
            "1 Kartenpaket",
            "No offline packs yet",
            "Noch keine Offline-Pakete",
        )
        if "No offline packs yet" not in xml and "Noch keine Offline-Pakete" not in xml:
            if (
                "Ready" in xml
                or "Bereit" in xml
                or "ready offline" in xml
                or "offline bereit" in xml
                or f"downloads.delete.{pack_id}" in xml
                or "statusSummaryReady" in xml
            ):
                # Confirm empty lead is gone
                if "No offline packs yet" not in xml and "Noch keine Offline-Pakete" not in xml:
                    print("PACK sealed / ready UI", flush=True)
                    return True
        # Progress still going
        time.sleep(3)
        # Keep screen awake / dismiss blocking sheets
        dismiss_download_banner(serial)
        dismiss_perm(serial, max_rounds=1)
    print("FAIL pack seal timeout", flush=True)
    return False


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
    lang = "de-DE" if locale.startswith("de") else "en-US"
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
    adb(serial, "shell", "cmd", "location", "set-location-enabled", "true", check=False)
    adb(serial, "shell", "settings", "put", "secure", "location_mode", "3", check=False)
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
            ensure_tap(serial, "onboarding.location.continue", scrolls=3) or ensure_tap(
                serial, "onboarding.location.foreground", scrolls=2
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
    assert wait_rid(serial, ["tab.map", "screen.map"], 90), "map not ready"
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

    # Seed named passage (≥3 legs) + activate
    seed_passage(serial, locale)
    geo_fix(serial, steps=12)
    ensure_tap(serial, "tab.map", scrolls=2)
    time.sleep(2)
    dismiss_download_banner(serial)
    wait_clean_gps_chrome(serial, timeout=40)
    geo_fix(serial, steps=6)
    time.sleep(1)
    screencap(serial, raw / "02-map-passage.png")

    # Passage detail — named + waypoint list
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

    # Seal ≥1 pack BEFORE empty-state lead on downloads
    sealed = seal_region_pack(serial, locale, pack_id="kiel-bay", timeout=720)
    print(f"seal_ok={sealed}", flush=True)
    ensure_tap(serial, "tab.downloads", scrolls=2) or ensure_tap(
        serial, text_substr="Offline", scrolls=2
    )
    time.sleep(1.5)
    # Lead with Ready status — scroll to top
    for _ in range(4):
        adb(serial, "shell", "input", "swipe", "540", "700", "540", "1500", "280", check=False)
        time.sleep(0.25)
    time.sleep(0.5)
    screencap(serial, raw / "04-downloads.png")

    # Offline map
    adb(serial, "shell", "cmd", "connectivity", "airplane-mode", "enable", check=False)
    time.sleep(1.5)
    ensure_tap(serial, "tab.map", scrolls=2)
    time.sleep(3)
    screencap(serial, raw / "05-offline.png")
    adb(serial, "shell", "cmd", "connectivity", "airplane-mode", "disable", check=False)
    time.sleep(1)

    # Normalize + write numbered fastlane + docs names
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
        img = fit_phone(Image.open(src), anchor="bottom")
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
    run(
        args.locale,
        args.serial,
        Path(args.apk),
        Path(args.docs_out),
        Path(args.fastlane_dir),
    )


if __name__ == "__main__":
    main()
