#!/usr/bin/env bash
# Tail Android logcat filtered for SeaCheck offline download diagnostics.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVD="${SEACHECK_AVD:-SeaCheck_Maestro_API_33}"

# shellcheck source=../../scripts/emulator-acquire.sh
source "$ROOT/../scripts/emulator-acquire.sh"

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  emulator_acquire "$AVD" --no-boot
  trap emulator_release EXIT
else
  emulator_require_serial
fi

PATTERN="${SEACHECK_LOG_PATTERN:-downloadStallWatchdog|offlinePackStore|OfflineMapEngineHost|warmupOfflineEngine|nativePackStatus|MapLibre|MLRN|seacheck}"

echo "==> logcat (downloads) on $ANDROID_SERIAL — pattern: $PATTERN"
echo "    Ctrl+C to stop"
echo ""

adb -s "$ANDROID_SERIAL" logcat -c 2>/dev/null || true
adb -s "$ANDROID_SERIAL" logcat -v time ReactNativeJS:V ReactNative:V *:S 2>/dev/null \
  | grep --line-buffered -Ei "$PATTERN" \
  || adb -s "$ANDROID_SERIAL" logcat -v time 2>/dev/null | grep --line-buffered -Ei "$PATTERN"
