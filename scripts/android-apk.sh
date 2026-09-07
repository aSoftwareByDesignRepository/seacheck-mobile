#!/usr/bin/env bash
# Build a release APK for sideloading — Play-compliant R8 + edge-to-edge tree.
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

echo "==> Building release APK"
export SEACHECK_APP_VARIANT=production
export NODE_ENV=production
cd android
./gradlew assembleRelease --no-daemon "$@"

APK_DIR="$ROOT/android/app/build/outputs/apk/release"
APK="$(ls -1 "$APK_DIR"/*.apk 2>/dev/null | head -1 || true)"
if [[ -z "${APK}" || ! -f "${APK}" ]]; then
  echo "ERROR: release APK not found under $APK_DIR" >&2
  exit 1
fi

echo ""
echo "==> Done:"
echo "    ${APK}"
ls -lh "${APK}"
