#!/usr/bin/env bash
# Run Android dev client on Metro port 8092 without prompting for another port when Metro is already up.
set -euo pipefail

PORT="${SEACHECK_METRO_PORT:-8092}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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

if command -v adb >/dev/null 2>&1; then
  if adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit !found }'; then
    adb reverse "tcp:$PORT" "tcp:$PORT" >/dev/null 2>&1 || true
  fi
fi

if metro_listening; then
  echo "==> Metro already on port $PORT — reusing it (no second bundler)"
  exec env CI=1 npx expo run:android --port "$PORT" "$@"
fi

echo "==> Metro not detected on port $PORT — building and starting bundler"
exec npx expo run:android --port "$PORT" "$@"
