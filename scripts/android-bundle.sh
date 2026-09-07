#!/usr/bin/env bash
# Build a release AAB for Google Play — Play-compliant R8 + edge-to-edge tree.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d android ]; then
  echo "==> No android/ folder — run prebuild first:"
  echo "    SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --clean"
  exit 1
fi

echo "==> Regenerating app icons from SVG sources"
npm run icons

bash scripts/play-android-prepare.sh

if [ "${SKIP_PREFLIGHT:-}" != "1" ]; then
  echo "==> Preflight quality gate"
  env -u NODE_ENV npm run preflight
fi

echo "==> Ensuring Android SDK path for Gradle"
bash scripts/ensure-android-local-properties.sh

echo "==> Building release AAB"
export SEACHECK_APP_VARIANT=production
export NODE_ENV=production
cd android
./gradlew bundleRelease --no-daemon "$@"

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "==> Done. Upload to Play Console:"
echo "    $AAB"
ls -lh "$AAB"
