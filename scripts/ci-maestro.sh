#!/usr/bin/env bash
# Build debug APK (if needed), start Metro, run Maestro download honesty on ONE emulator.
#
# Intended for GitHub Actions android-emulator-runner (script:). Also usable locally:
#   SEACHECK_MAESTRO_DEVICE=emulator-5554 bash scripts/ci-maestro.sh
#
# Weakness (honest): Kiel Bay download needs outbound HTTPS to OpenSeaMap from the
# emulator. CDN/rate-limit flakes are retried below — not mocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

METRO_PORT="${SEACHECK_METRO_PORT:-8092}"
ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
export PATH="${HOME}/.maestro/bin:${ANDROID_HOME:+$ANDROID_HOME/platform-tools:}${ANDROID_HOME:+$ANDROID_HOME/emulator:}${PATH:-}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v adb >/dev/null 2>&1 || die "adb missing"
command -v maestro >/dev/null 2>&1 || die "maestro missing (curl -Ls 'https://get.maestro.mobile.dev' | bash)"

DEVICE="${SEACHECK_MAESTRO_DEVICE:-${ANDROID_SERIAL:-}}"
if [[ -z "$DEVICE" ]]; then
  # Prefer a ready emulator (device state), not offline/unauthorized.
  DEVICE="$(adb devices | awk '/^emulator-/{ if ($2 == "device") { print $1; exit } }')"
fi
if [[ -z "$DEVICE" ]]; then
  log "adb devices:"; adb devices -l || true
  die "No emulator serial (set SEACHECK_MAESTRO_DEVICE or ANDROID_SERIAL)"
fi
export SEACHECK_MAESTRO_DEVICE="$DEVICE"
log "emulator serial=$DEVICE"
export SEACHECK_METRO_PORT="$METRO_PORT"
# Single-emulator CI: still safe if other Check apps are installed.
export SEACHECK_MAESTRO_DISABLE_RIVALS="${SEACHECK_MAESTRO_DISABLE_RIVALS:-1}"
export SEACHECK_MAESTRO_CLEAR="${SEACHECK_MAESTRO_CLEAR:-1}"

APK="${SEACHECK_DEBUG_APK:-$ROOT/android/app/build/outputs/apk/debug/app-debug.apk}"

ensure_apk() {
  if [[ -f "$APK" ]]; then
    log "using existing APK $APK"
    return 0
  fi
  log "building debug APK (expo prebuild + assembleDebug)"
  command -v java >/dev/null 2>&1 || die "java missing for gradle"
  npx expo prebuild --platform android --non-interactive
  bash "$ROOT/scripts/ensure-android-local-properties.sh"
  (
    cd "$ROOT/android"
    ./gradlew assembleDebug --no-daemon
  )
  [[ -f "$APK" ]] || die "assembleDebug did not produce $APK"
}

metro_pid=""
cleanup() {
  if [[ -n "${metro_pid}" ]] && kill -0 "$metro_pid" 2>/dev/null; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

start_metro() {
  if curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status"; then
    log "Metro already on :${METRO_PORT}"
    return 0
  fi
  log "starting Metro on :${METRO_PORT}"
  npx expo start --port "$METRO_PORT" --dev-client >/tmp/seacheck-ci-metro.log 2>&1 &
  metro_pid=$!
  for i in $(seq 1 90); do
    if curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status"; then
      log "Metro ready (iter $i)"
      return 0
    fi
    if ! kill -0 "$metro_pid" 2>/dev/null; then
      tail -40 /tmp/seacheck-ci-metro.log || true
      die "Metro exited before becoming ready"
    fi
    sleep 2
  done
  tail -40 /tmp/seacheck-ci-metro.log || true
  die "Metro did not become ready on :${METRO_PORT}"
}

ensure_apk
adb -s "$DEVICE" wait-for-device
# Stay awake; dismiss keyguard best-effort
adb -s "$DEVICE" shell settings put global stay_on_while_plugged_in 3 >/dev/null 2>&1 || true
adb -s "$DEVICE" shell input keyevent 82 >/dev/null 2>&1 || true

log "installing APK"
adb -s "$DEVICE" install -r "$APK"

start_metro
adb -s "$DEVICE" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true

# Retry once — OpenSeaMap CDN / cold Metro bundle flakes are common on GHA.
attempts="${SEACHECK_MAESTRO_ATTEMPTS:-2}"
rc=1
for attempt in $(seq 1 "$attempts"); do
  log "maestro attempt $attempt/$attempts (device=$DEVICE)"
  if bash "$ROOT/scripts/maestro-e2e.sh" all; then
    rc=0
    break
  fi
  rc=$?
  log "maestro attempt $attempt failed (exit $rc)"
  sleep 5
done

[[ "$rc" -eq 0 ]] || die "Maestro download honesty failed after $attempts attempt(s)"
log "ci-maestro passed"
exit 0
