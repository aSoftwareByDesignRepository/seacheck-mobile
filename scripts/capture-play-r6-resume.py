#!/usr/bin/env python3
"""Resume R6 after clean EN#1 — finish EN #2–5 + full DE + write_ready.

Assumes: APK installed, kiel sealed, EN #1+#6 already in _raw-live-en-US.
"""
from __future__ import annotations

import importlib.util
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "capr6",
    "/home/alex/Development/nextcloud-dev/mobile/seacheck/scripts/capture-play-r6.py",
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

from PIL import Image
import io


def finish_en_from_2():
    loc = "en-US"
    raw = m.DOCS / f"_raw-live-{loc}"
    assert (raw / "01-map-hero.png").exists(), "missing EN#1"
    assert (raw / "06-safety.png").exists(), "missing EN#6"
    m.ensure_adb_root()
    m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
    m.sh("shell", "svc", "wifi", "enable", t=8)
    m.sh("shell", "settings", "put", "system", "system_locales", "en-US", t=8)
    m.sh("shell", "cmd", "locale", "set-app-locales", m.PKG, "--locales", "en-US", t=8)

    # #2 theatre
    m.seed_db(active=1)
    m.patch_settings_dismiss_tips(layout="map-forward")
    m.focus()
    time.sleep(1.5)
    lon2, lat2 = m.GEO_PASSAGE
    m.reset_gps_baseline(lon2, lat2, kn=5.2)
    m.tap(135, 2029, 0.6)
    m.dismiss_modals()
    m.tap_id(rid="passage.preview.showOnMap", scrolls=0)
    m.wait_map_clean(f"{loc}#2pre", lon2, lat2, kn=5.2)
    m.scroll_dock_to_top()
    xml = m.dump()
    if "map.passageInstrument" not in xml or ("Leg " not in xml and "Etappe " not in xml):
        print("THEATRE_WEAK → instruments-only", flush=True)
        m.patch_settings_dismiss_tips(layout="instruments-only")
        m.focus()
        time.sleep(1.8)
        m.ensure_unlocked()
        m.dismiss_modals()
        m.geo_at(lon2, lat2, n=10, kn=5.2)
        time.sleep(0.8)
        for _ in range(5):
            m.swipe(540, 800, 540, 1600, 280)
            time.sleep(0.2)
    for attempt in range(14):
        m.scroll_dock_to_top()
        xml = m.dump()
        m.assert_passage_theatre(xml, f"{loc}#2")
        m.assert_map_clean(xml, f"{loc}#2")
        m.geo_at(lon2, lat2, n=4, kn=5.2)
        time.sleep(1.0)
        data = m.screencap_png()
        img = Image.open(io.BytesIO(data))
        score = m.jump_pill_score(img)
        sc = m.scribble_score(img, 0.55)
        print(f"PILL {loc}#2={score} SCRIBBLE={sc}", flush=True)
        if m.has_jump_pill(img):
            m.reset_gps_baseline(lon2, lat2, kn=5.2)
            continue
        if m.has_scribble(img, 0.55):
            lon2 = m.GEO_PASSAGE[0] + 0.005 * ((attempt % 3) - 1)
            lat2 = m.GEO_PASSAGE[1] + 0.004 * ((attempt % 5) - 2)
            print(f"SCRIBBLE_FAIL {loc}#2 nudge → {lon2:.4f},{lat2:.4f}", flush=True)
            m.reset_gps_baseline(lon2, lat2, kn=5.2)
            m.dismiss_modals()
            continue
        (raw / "02-map-passage.png").write_bytes(data)
        print(f"CAPTURED 02-map-passage.png pill={score} scribble={sc}", flush=True)
        break
    else:
        raise SystemExit(f"{loc}#2 could not capture clean theatre map")
    m.patch_settings_dismiss_tips(layout="map-forward")

    # #3
    m.focus()
    time.sleep(1.2)
    m.tap(405, 2029, 0.8)
    time.sleep(0.7)
    m.ensure_unlocked()
    xml = m.dump()
    import re

    mm = re.search(r'resource-id="passage\.card\.open\.[^"]+"', xml)
    if mm:
        m.tap_id(rid=mm.group(0).split('"')[1], scrolls=0)
    else:
        m.tap(540, 720, 0.8)
    time.sleep(0.6)
    xml = m.scroll_passage_waypoints_visible()
    m.assert_not_forbidden(xml, f"{loc}#3")
    m.cap(raw / "03-passage-detail.png")

    # #4
    m.sh("shell", "am", "force-stop", m.PKG, t=8)
    m.sh("shell", f'sqlite3 {m.DB} "UPDATE passages SET is_active=0;"', t=10)
    m.focus()
    time.sleep(2)
    m.ensure_unlocked()
    if not m.offline_has_kiel():
        ok = m.seal()
        print("SEALED_RETRY", ok, flush=True)
        if not ok:
            raise SystemExit(f"{loc} seal retry failed")
    else:
        if not m.open_downloads():
            raise SystemExit(f"{loc}#4 cannot open downloads")
    xml = m.scroll_downloads_pack_in_fold()
    m.assert_not_forbidden(xml, f"{loc}#4")
    if "Kieler Bucht" not in xml and "Kiel Bay" not in xml:
        raise SystemExit(f"{loc}#4 dump missing Kieler Bucht/Bay title text")
    m.cap(raw / "04-downloads.png")

    # #5
    m.sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
    time.sleep(1.2)
    m.tap(135, 2029, 0.8)
    m.reset_gps_baseline(*m.GEO_OFFLINE, kn=6.8)
    m.cap_map_clean(raw / "05-offline.png", f"{loc}#5", *m.GEO_OFFLINE, kn=6.8, map_frac=1.0)
    m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)

    m.write_locale_outputs(loc, raw)
    print("EN_RESUME_DONE", flush=True)


def main():
    finish_en_from_2()
    m.run_locale("de-DE")
    m.write_ready()
    print("R6_RESUME_COMPLETE", flush=True)


if __name__ == "__main__":
    main()
