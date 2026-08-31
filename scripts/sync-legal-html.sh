#!/usr/bin/env bash
# Render SeaCheck legal pages from website PHP stubs → static HTML for Play preflight.
# Writes website/{en,de}/*.html and mirrors to docs/play-store/publish/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEBSITE="$(cd "$ROOT/../../website" && pwd)"

command -v php >/dev/null 2>&1 || { echo "ERROR: php CLI required"; exit 1; }

export PYTHONPATH="$WEBSITE"

python3 <<PY
from pathlib import Path
import sys

sys.path.insert(0, str(Path("$WEBSITE") / "scripts"))
from render_site import read_public

website = Path("$WEBSITE")
root = Path("$ROOT")

pages = [
    ("en/privacy-seacheck-mobile.html", "publish/en/privacy-seacheck-mobile.html"),
    ("en/terms-seacheck-mobile.html", "publish/en/terms-seacheck-mobile.html"),
    ("de/datenschutz-seacheck-mobile.html", "publish/de/datenschutz-seacheck-mobile.html"),
    ("de/nutzungsbedingungen-seacheck-mobile.html", "publish/de/nutzungsbedingungen-seacheck-mobile.html"),
]

for rel, mirror in pages:
    html = read_public(rel)
    dest = website / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    print(f"wrote {dest.relative_to(website.parent)}")
    mirror_path = root / "docs/play-store" / mirror
    mirror_path.parent.mkdir(parents=True, exist_ok=True)
    mirror_path.write_text(html, encoding="utf-8")
    print(f"  mirrored → {mirror_path.relative_to(root)}")
PY

echo "OK — legal HTML synced"
