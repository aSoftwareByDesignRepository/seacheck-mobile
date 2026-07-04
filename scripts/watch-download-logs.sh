#!/usr/bin/env bash
# Tail Android logcat filtered for SeaCheck offline download diagnostics.
set -euo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found" >&2
  exit 1
fi

adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit !found }' \
  || { echo "ERROR: no adb device connected" >&2; exit 1; }

PATTERN="${SEACHECK_LOG_PATTERN:-downloadStallWatchdog|offlinePackStore|OfflineMapEngineHost|warmupOfflineEngine|nativePackStatus|MapLibre|MLRN|seacheck}"

echo "==> logcat (downloads) — pattern: $PATTERN"
echo "    Ctrl+C to stop"
echo ""

adb logcat -c 2>/dev/null || true
adb logcat -v time ReactNativeJS:V ReactNative:V *:S 2>/dev/null \
  | grep --line-buffered -Ei "$PATTERN" \
  || adb logcat -v time 2>/dev/null | grep --line-buffered -Ei "$PATTERN"
