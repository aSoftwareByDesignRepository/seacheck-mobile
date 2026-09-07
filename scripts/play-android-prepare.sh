#!/usr/bin/env bash
# Idempotent Android 15 / Play Console prep before assembleRelease / bundleRelease.
# Closes: deprecated edge-to-edge bar colors, R8/minify tree flags, RN Window patches, WebP splash.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d android ]]; then
  echo "play-android-prepare: no android/ — skip (run expo prebuild first)"
  exit 0
fi

echo "==> Android 15 Play compliance tree patch (R8 + edge styles + proguard-optimize)"
node -e "const { patchAndroidTree } = require('@check/android15-play-compliance/patch'); const r = patchAndroidTree(process.cwd()); console.log(r.skipped ? 'skipped (no android)' : (r.changes.length ? 'patched: ' + r.changes.join(', ') : 'already compliant'));"

echo "==> Optimize Android splash/brand bitmaps → WebP"
node scripts/optimize-android-bitmaps.mjs

echo "==> Patch RN edge-to-edge deprecated Window APIs"
npm run patch:rn-edge
