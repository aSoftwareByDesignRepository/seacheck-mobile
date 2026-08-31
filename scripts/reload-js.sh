#!/usr/bin/env bash
# Push a Metro reload to a connected Android device/emulator (JS-only changes — no Gradle rebuild).
set -euo pipefail

PORT="${SEACHECK_METRO_PORT:-8092}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVD="${SEACHECK_AVD:-SeaCheck_Maestro_API_33}"

reload_via_metro() {
  if curl -sf -o /dev/null -X POST "http://127.0.0.1:${PORT}/reload" 2>/dev/null; then
    echo "==> Metro reload sent (http://127.0.0.1:${PORT}/reload)"
    return 0
  fi
  return 1
}

reload_via_adb() {
  # shellcheck source=../../scripts/emulator-acquire.sh
  source "$ROOT/../scripts/emulator-acquire.sh"
  if [[ -z "${ANDROID_SERIAL:-}" ]]; then
    emulator_acquire "$AVD" --no-boot
    trap emulator_release EXIT
  else
    emulator_require_serial
  fi
  adb -s "$ANDROID_SERIAL" shell input keyevent 82 >/dev/null 2>&1 || true
  sleep 0.4
  adb -s "$ANDROID_SERIAL" shell input text "RR" >/dev/null 2>&1 || true
  echo "==> Requested reload via adb on $ANDROID_SERIAL (shake menu). If nothing happens, press r in the Metro terminal."
}

if reload_via_metro; then
  exit 0
fi

if reload_via_adb; then
  exit 0
fi

echo "ERROR: Could not reload. Start Metro (npm start) and acquire an emulator lock first." >&2
exit 1
