#!/usr/bin/env python3
"""R6 finish: recapture EN#2 (scribble<200) + full DE + write_ready.

Keeps EN #1/#3/#4/#5/#6 if present and gates pass.
"""
from __future__ import annotations

import importlib.util
import io
import re
import time
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "capr6",
    "/home/alex/Development/nextcloud-dev/mobile/seacheck/scripts/capture-play-r6.py",
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

assert m.SCRIBBLE_MAX == 200
assert m.scribble_score.__doc__.startswith("Critic R5")


def capture_passage_2(loc: str, raw: Path):
    lang = "de-DE" if loc.startswith("de") else "en-US"
    m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
    m.sh("shell", "svc", "wifi", "enable", t=8)
    m.sh("shell", "settings", "put", "system", "system_locales", lang, t=8)
    m.sh("shell", "cmd", "locale", "set-app-locales", m.PKG, "--locales", lang, t=8)
    m.seed_db(active=1)
    m.patch_settings_dismiss_tips(layout="map-forward")
    m.focus()
    time.sleep(1.5)
    # Prefer open-water mid-Förde; nudge north if scribble
    candidates = [
        m.GEO_PASSAGE,
        (10.185, 54.370),
        (10.190, 54.375),
        (10.175, 54.365),
        (10.195, 54.380),
    ]
    for ci, (lon2, lat2) in enumerate(candidates):
        print(f"TRY_PASSAGE {loc} cand={ci} {lon2},{lat2}", flush=True)
        m.reset_gps_baseline(lon2, lat2, kn=5.2)
        m.tap(135, 2029, 0.6)
        m.dismiss_modals()
        m.tap_id(rid="passage.preview.showOnMap", scrolls=0)
        try:
            m.wait_map_clean(f"{loc}#2pre/{ci}", lon2, lat2, kn=5.2, timeout=55)
        except SystemExit as e:
            print("WAIT_CLEAN fail", e, flush=True)
            continue
        m.scroll_dock_to_top()
        xml = m.dump()
        if "map.passageInstrument" not in xml or ("Leg " not in xml and "Etappe " not in xml):
            m.patch_settings_dismiss_tips(layout="instruments-only")
            m.focus()
            time.sleep(1.5)
            m.dismiss_modals()
            m.geo_at(lon2, lat2, n=8, kn=5.2)
            for _ in range(4):
                m.swipe(540, 800, 540, 1600, 280)
                time.sleep(0.15)
        for attempt in range(8):
            m.scroll_dock_to_top()
            xml = m.dump()
            try:
                m.assert_passage_theatre(xml, f"{loc}#2")
                m.assert_map_clean(xml, f"{loc}#2")
            except SystemExit as e:
                print("assert fail", e, flush=True)
                m.reset_gps_baseline(lon2, lat2, kn=5.2)
                m.dismiss_modals()
                continue
            m.geo_at(lon2, lat2, n=3, kn=5.2)
            time.sleep(0.8)
            data = m.screencap_png()
            img = Image.open(io.BytesIO(data))
            score = m.jump_pill_score(img)
            sc = m.scribble_score(img)
            print(f"PILL {loc}#2={score} SCRIBBLE={sc}", flush=True)
            if m.has_jump_pill(img) or m.has_scribble(img):
                lon2 += 0.004 * ((attempt % 3) - 1)
                lat2 += 0.003 * ((attempt % 5) - 2)
                m.reset_gps_baseline(lon2, lat2, kn=5.2)
                continue
            (raw / "02-map-passage.png").write_bytes(data)
            print(f"CAPTURED 02 scribble={sc}", flush=True)
            m.patch_settings_dismiss_tips(layout="map-forward")
            return
    raise SystemExit(f"{loc}#2 failed all candidates")


def ensure_en_345(raw: Path):
    """Re-check #3/#4; recapture if needles missing."""
    # #3
    need3 = True
    p3 = raw / "03-passage-detail.png"
    if p3.exists() and p3.stat().st_size > 90000:
        # quick dump-less: re-open and verify live instead
        need3 = True
    m.focus()
    time.sleep(1)
    m.tap(405, 2029, 0.8)
    time.sleep(0.7)
    xml = m.dump()
    mm = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml)
    if mm:
        m.tap_id(rid=mm.group(0).split('"')[1], scrolls=0)
    else:
        m.tap(540, 720, 0.8)
    time.sleep(0.5)
    xml = m.scroll_passage_waypoints_visible()
    m.cap(raw / "03-passage-detail.png")

    m.sh("shell", "am", "force-stop", m.PKG, t=8)
    m.sh("shell", f'sqlite3 {m.DB} "UPDATE passages SET is_active=0;"', t=10)
    m.focus()
    time.sleep(2)
    if not m.offline_has_kiel():
        if not m.seal():
            raise SystemExit("seal failed")
    else:
        if not m.open_downloads():
            raise SystemExit("open downloads failed")
    xml = m.scroll_downloads_pack_in_fold()
    if "Kieler Bucht" not in xml and "Kiel Bay" not in xml:
        raise SystemExit("#4 missing Kieler title")
    m.cap(raw / "04-downloads.png")

    # #5 if scribble
    p5 = raw / "05-offline.png"
    if (not p5.exists()) or m.has_scribble(Image.open(p5)):
        m.sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
        time.sleep(1)
        m.tap(135, 2029, 0.8)
        m.reset_gps_baseline(*m.GEO_OFFLINE, kn=6.8)
        m.cap_map_clean(raw / "05-offline.png", "en-US#5", *m.GEO_OFFLINE, kn=6.8)
        m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)


def main():
    m.ensure_adb_root()
    en = m.DOCS / "_raw-live-en-US"
    # EN#2
    capture_passage_2("en-US", en)
    # Ensure #3/#4/#5
    ensure_en_345(en)
    # Validate EN map gates
    for name, must in [("01-map-hero.png", True), ("02-map-passage.png", True), ("05-offline.png", True)]:
        img = Image.open(en / name)
        sc = m.scribble_score(img)
        print(f"GATE en {name} scribble={sc}", flush=True)
        if must and m.has_scribble(img):
            raise SystemExit(f"EN {name} still scribble={sc}")
    m.write_locale_outputs("en-US", en)
    print("EN_OK", flush=True)

    # Full DE
    m.run_locale("de-DE")
    m.write_ready()
    print("R6_FINISH_DONE", flush=True)


if __name__ == "__main__":
    main()
