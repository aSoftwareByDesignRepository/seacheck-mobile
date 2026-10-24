#!/usr/bin/env bash
# Run Android dev client on Metro port 8092 without prompting for another port when Metro is already up.
set -euo pipefail

PORT="${SEACHECK_METRO_PORT:-8092}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVD="${SEACHECK_AVD:-SeaCheck_Atlas_API_36}"

metro_listening() {
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :$PORT" 2>/dev/null | grep -q .
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1
    return
  fi
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/status" 2>/dev/null
}

cd "$ROOT"

# shellcheck source=../../scripts/emulator-acquire.sh
source "$ROOT/../scripts/emulator-acquire.sh"
emulator_acquire "$AVD" --boot-if-needed
trap emulator_release EXIT
emulator_adb_reverse "$PORT"

if metro_listening; then
  # A listening port is not proof it is our Metro (foreign_dev_server_on_port).
  source "$ROOT/../scripts/metro-guard.sh"
  assert_own_metro "$PORT" "$ROOT" "SEACHECK_METRO_PORT" || exit 1
  echo "==> Metro already on port $PORT — reusing it (no second bundler)"
  env CI=1 ANDROID_SERIAL="$ANDROID_SERIAL" npx expo run:android --port "$PORT" "$@"
  exit
fi

echo "==> Metro not detected on port $PORT — building and starting bundler"
env ANDROID_SERIAL="$ANDROID_SERIAL" npx expo run:android --port "$PORT" "$@"
