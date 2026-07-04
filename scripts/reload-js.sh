#!/usr/bin/env bash
# Push a Metro reload to a connected Android device/emulator (JS-only changes — no Gradle rebuild).
set -euo pipefail

PORT="${SEACHECK_METRO_PORT:-8092}"

reload_via_metro() {
  if curl -sf -o /dev/null -X POST "http://127.0.0.1:${PORT}/reload" 2>/dev/null; then
    echo "==> Metro reload sent (http://127.0.0.1:${PORT}/reload)"
    return 0
  fi
  return 1
}

reload_via_adb() {
  command -v adb >/dev/null 2>&1 || return 1
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit !found }' || return 1
  # Dev menu → Reload (works with Expo dev client / RN debugger connected)
  adb shell input keyevent 82 >/dev/null 2>&1 || true
  sleep 0.4
  adb shell input text "RR" >/dev/null 2>&1 || true
  echo "==> Requested reload via adb (shake menu). If nothing happens, press r in the Metro terminal."
}

if reload_via_metro; then
  exit 0
fi

if reload_via_adb; then
  exit 0
fi

echo "ERROR: Could not reload. Start Metro (npm start) and ensure a device is connected." >&2
exit 1
