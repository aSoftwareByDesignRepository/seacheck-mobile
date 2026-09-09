#!/usr/bin/env bash
# Capture live Play Store phone screenshots from a production APK on emulator.
# Locale-correct captures (never clone en↔de):
#   SEACHECK_MAESTRO_DEVICE=emulator-5602 \
#   SEACHECK_RELEASE_APK=android/app/build/outputs/apk/release/app-release.apk \
#   bash scripts/capture-play-screenshots.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERIAL="${SEACHECK_MAESTRO_DEVICE:-${ANDROID_SERIAL:-}}"
APK="${SEACHECK_RELEASE_APK:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
if [[ -z "$SERIAL" ]]; then
  echo "Set SEACHECK_MAESTRO_DEVICE / ANDROID_SERIAL after emulator_acquire" >&2
  exit 1
fi
if [[ ! -f "$APK" ]]; then
  echo "Missing APK: $APK" >&2
  exit 1
fi

for loc in en-US de-DE; do
  python3 "$ROOT/scripts/capture-play-locale.py" \
    --locale "$loc" \
    --serial "$SERIAL" \
    --apk "$APK" \
    --docs-out "$ROOT/docs/play-store/assets/screenshots" \
    --fastlane-dir "$ROOT/fastlane/metadata/android/$loc/images/phoneScreenshots"
done

echo "==> Live en-US + de-DE phone shots ready (no locale cloning)"
ls -lh "$ROOT/fastlane/metadata/android/en-US/images/phoneScreenshots"/*.png
ls -lh "$ROOT/fastlane/metadata/android/de-DE/images/phoneScreenshots"/*.png
