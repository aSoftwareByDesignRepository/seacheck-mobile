#!/usr/bin/env python3
"""Resume SeaCheck Play R5: recapture EN #1 (cleaner water), finish EN #4/#5, full DE, write_ready."""
from __future__ import annotations

import hashlib
import importlib.util
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "capr5",
    "/home/alex/Development/nextcloud-dev/mobile/seacheck/scripts/capture-play-r5.py",
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

print("R5_RESUME_START", flush=True)
raw = m.DOCS / "_raw-live-en-US"
raw.mkdir(parents=True, exist_ok=True)

m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
m.sh("shell", "svc", "wifi", "enable", t=8)
m.patch_settings_dismiss_tips(layout="map-forward")
m.focus()
time.sleep(1.5)
m.ensure_unlocked()
m.dismiss_modals()
m.tap(135, 2029, 0.6)
m.reset_gps_baseline(*m.GEO_HERO, kn=4.8)
m.cap_map_clean(raw / "01-map-hero.png", "en-US#1", *m.GEO_HERO, kn=4.8)
print("RECAPTURED en#1", flush=True)

# #4 downloads — kiel-bay already sealed
m.sh("shell", "am", "force-stop", m.PKG, t=8)
m.sh("shell", f'sqlite3 {m.DB} "UPDATE passages SET is_active=0;"', t=10)
m.focus()
time.sleep(2)
m.ensure_unlocked()
if not m.offline_has_kiel():
    ok = m.seal()
    print("SEALED", ok, flush=True)
    if not ok:
        raise SystemExit("en seal failed")
else:
    if not m.open_downloads():
        raise SystemExit("cannot open downloads")
xml = m.scroll_downloads_pack_in_fold()
m.assert_not_forbidden(xml, "en-US#4")
m.cap(raw / "04-downloads.png")
print("CAPTURED en#4", flush=True)

m.sh("shell", "cmd", "connectivity", "airplane-mode", "enable", t=8)
time.sleep(1.2)
m.tap(135, 2029, 0.8)
m.reset_gps_baseline(*m.GEO_OFFLINE, kn=6.8)
m.cap_map_clean(raw / "05-offline.png", "en-US#5", *m.GEO_OFFLINE, kn=6.8)
m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)

hashes = []
for i, name in enumerate(
    [
        "01-map-hero.png",
        "02-map-passage.png",
        "03-passage-detail.png",
        "04-downloads.png",
        "05-offline.png",
        "06-safety.png",
    ],
    1,
):
    p = raw / name
    if not p.exists() or p.stat().st_size < 90000:
        raise SystemExit(f"weak en {name}")
    h = hashlib.md5(p.read_bytes()).hexdigest()
    hashes.append(h)
    print(f"CHK en-US #{i} {p.stat().st_size} {h}", flush=True)
if len(set(hashes)) < 6 or hashes[1] == hashes[2]:
    raise SystemExit(f"en hash fail {hashes}")
m.write_locale_outputs("en-US", raw)
print("LOCALE_DONE en-US", flush=True)
print("START_DE", flush=True)
m.run_locale("de-DE")
m.write_ready()
print("ALL_DONE", flush=True)
