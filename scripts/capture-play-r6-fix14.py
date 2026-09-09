#!/usr/bin/env python3
"""Fix EN #1 (must be map not downloads) + EN #4 title, then full DE + write_ready."""
from __future__ import annotations

import hashlib
import importlib.util
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "capr6",
    "/home/alex/Development/nextcloud-dev/mobile/seacheck/scripts/capture-play-r6.py",
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

print("R6_FIX14_START", flush=True)
raw = m.DOCS / "_raw-live-en-US"
raw.mkdir(parents=True, exist_ok=True)

for need in ("02-map-passage.png", "03-passage-detail.png", "05-offline.png", "06-safety.png"):
    p = raw / need
    if not p.exists() or p.stat().st_size < 90000:
        raise SystemExit(f"missing keep {need}")

m.sh("shell", "cmd", "connectivity", "airplane-mode", "disable", t=8)
m.sh("shell", "svc", "wifi", "enable", t=8)
m.ensure_adb_root()
m.sh("shell", "cmd", "locale", "set-app-locales", m.PKG, "--locales", "en-US", t=8)
m.focus()
time.sleep(1.5)
m.ensure_unlocked()
m.dismiss_modals()

if not m.offline_has_kiel():
    ok = m.seal()
    print("SEAL", ok, flush=True)
    if not ok:
        raise SystemExit("seal failed")

# Leave downloads — force map
m.tap(135, 2029, 0.8)
time.sleep(1.0)
xml = m.dump()
if "screen.downloads" in xml:
    m.tap(135, 2029, 0.8)
    time.sleep(1.0)
m.reset_gps_baseline(*m.GEO_HERO, kn=4.8)
# Hard require map screen before capture
for _ in range(8):
    xml = m.dump()
    if "screen.map" in xml and "screen.downloads" not in xml:
        break
    m.tap(135, 2029, 0.7)
    time.sleep(0.8)
else:
    raise SystemExit("cannot reach screen.map for #1")
m.cap_map_clean(raw / "01-map-hero.png", "en-US#1", *m.GEO_HERO, kn=4.8, map_frac=1.0)
# Verify not downloads
data = (raw / "01-map-hero.png").read_bytes()
if b"Offline charts" in data or b"Offline-Karten" in data:
    raise SystemExit("#1 still looks like downloads (png text)")
# pixel: downloads are white-heavy; map is blue-heavy
from PIL import Image
import numpy as np

im = np.array(Image.open(raw / "01-map-hero.png"))
c = im[400:900, 200:800]
blue = float(((c[:, :, 2] > c[:, :, 0] + 20) & (c[:, :, 2] > 140)).mean())
white = float(((c[:, :, 0] > 230) & (c[:, :, 1] > 230) & (c[:, :, 2] > 230)).mean())
print(f"#1 QA blue={blue:.3f} white={white:.3f}", flush=True)
if white > 0.5 and blue < 0.25:
    raise SystemExit("#1 QA fail — still list UI not map")

# #4 Kiel Bay title fully under banner
m.sh("shell", "am", "force-stop", m.PKG, t=8)
m.sh("shell", f'sqlite3 {m.DB} "UPDATE passages SET is_active=0;"', t=10)
m.focus()
time.sleep(2)
m.ensure_unlocked()
if not m.open_downloads():
    raise SystemExit("open downloads failed")
xml = m.scroll_downloads_pack_in_fold()
if "Kiel Bay" not in xml and "Kieler Bucht" not in xml:
    raise SystemExit("#4 title missing in dump")
m.assert_not_forbidden(xml, "en-US#4")
m.cap(raw / "04-downloads.png")

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
    h = hashlib.md5(p.read_bytes()).hexdigest()
    hashes.append(h)
    print(f"CHK en-US #{i} {p.stat().st_size} {h}", flush=True)
if len(set(hashes)) < 6:
    raise SystemExit(f"en dup {hashes}")
m.write_locale_outputs("en-US", raw)
print("EN_FIXED", flush=True)

print("START_DE", flush=True)
m.run_locale("de-DE")
m.write_ready()
print("ALL_DONE", flush=True)
