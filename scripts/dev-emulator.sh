#!/usr/bin/env bash
# One-shot local test: Android emulator + Metro + dev client install.
#
# Usage:
#   npm run dev
#   npm run dev -- --avd Pixel_API_33
#   npm run dev -- --preflight
#
# Re-run safely: reuses running emulator and Metro when possible.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
METRO_PORT="${SEACHECK_METRO_PORT:-8092}"
AVD="${SEACHECK_AVD:-Pixel_3_API_33}"
ANDROID_HOME="${ANDROID_HOME:-/home/alex/Android/Sdk}"

SKIP_EMULATOR=0
SKIP_ANDROID=0
RUN_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-emulator) SKIP_EMULATOR=1 ;;
    --skip-android) SKIP_ANDROID=1 ;;
    --preflight) RUN_PREFLIGHT=1 ;;
    --avd)
      shift
      AVD="${1:?--avd requires a name}"
      ;;
    -h | --help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

log() { printf '==> %s\n' "$*"; }
warn() { printf '!! %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

METRO_PID=""
EMULATOR_PID=""
METRO_STARTED_BY_SCRIPT=0
EMULATOR_STARTED_BY_SCRIPT=0

cleanup() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    warn "dev-emulator failed (exit $code)."
  fi
}
trap cleanup EXIT

port_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :$port" 2>/dev/null | grep -q .
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
    return
  fi
  curl -sf -o /dev/null "http://127.0.0.1:$port/status" 2>/dev/null
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

setup_android_path() {
  export ANDROID_HOME
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
  [[ -x "$ANDROID_HOME/emulator/emulator" ]] || die "Android emulator not found at $ANDROID_HOME/emulator/emulator"
  [[ -x "$ANDROID_HOME/platform-tools/adb" ]] || die "adb not found at $ANDROID_HOME/platform-tools/adb"
}

ensure_node_deps() {
  if [[ ! -d "$APP_ROOT/node_modules" ]]; then
    log "Installing npm dependencies"
    (cd "$APP_ROOT" && npm install)
  fi
}

maybe_preflight() {
  [[ $RUN_PREFLIGHT -eq 0 ]] && return 0
  log "Running preflight"
  (cd "$APP_ROOT" && npm run preflight)
}

adb_device_ready() {
  "$ANDROID_HOME/platform-tools/adb" devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit !found }'
}

wait_for_emulator_boot() {
  log "Waiting for emulator to finish booting"
  "$ANDROID_HOME/platform-tools/adb" wait-for-device
  local attempt=0
  while [[ $attempt -lt 120 ]]; do
    local boot
    boot="$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$boot" == "1" ]]; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  die "Emulator did not finish booting within 4 minutes"
}

ensure_emulator() {
  [[ $SKIP_EMULATOR -eq 1 ]] && return 0
  setup_android_path

  if adb_device_ready; then
    log "Android device/emulator already connected"
    return 0
  fi

  local avds
  avds="$("$ANDROID_HOME/emulator/emulator" -list-avds)"
  echo "$avds" | grep -qx "$AVD" || die "AVD not found: $AVD (available: $(echo "$avds" | tr '\n' ' '))"

  log "Starting emulator: $AVD"
  "$ANDROID_HOME/emulator/emulator" -avd "$AVD" -no-boot-anim >/dev/null 2>&1 &
  EMULATOR_PID=$!
  EMULATOR_STARTED_BY_SCRIPT=1
  wait_for_emulator_boot
  log "Emulator ready"
}

wait_for_metro() {
  local attempt=0
  while [[ $attempt -lt 90 ]]; do
    if port_listening "$METRO_PORT"; then
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  die "Metro did not start on port $METRO_PORT within 90s (see $APP_ROOT/.expo/dev-metro.log)"
}

ensure_metro() {
  if port_listening "$METRO_PORT"; then
    log "Metro already on port $METRO_PORT"
    return 0
  fi

  log "Starting Metro on port $METRO_PORT (background)"
  mkdir -p "$APP_ROOT/.expo"
  (cd "$APP_ROOT" && npx expo start --port "$METRO_PORT") >"$APP_ROOT/.expo/dev-metro.log" 2>&1 &
  METRO_PID=$!
  METRO_STARTED_BY_SCRIPT=1
  wait_for_metro
  log "Metro ready (log: .expo/dev-metro.log)"
}

install_android_app() {
  [[ $SKIP_ANDROID -eq 1 ]] && return 0
  log "Building and installing Android dev client"
  bash "$APP_ROOT/scripts/run-android.sh"
}

print_done() {
  cat <<EOF

────────────────────────────────────────────────────────
SeaCheck dev environment is ready.

  Metro: http://127.0.0.1:$METRO_PORT

First launch shows onboarding (disclaimer, location, battery).
Then: Map · Passage · Waypoints · Tracks · Downloads · Settings

Reload JS after code edits:
  - Re-run: npm run dev   (reuses running Metro/emulator)
  - Or foreground Metro: npm start   (press r to reload)

EOF
  if [[ $METRO_STARTED_BY_SCRIPT -eq 1 && -n "$METRO_PID" ]]; then
    echo "  Metro background PID: $METRO_PID"
  fi
  if [[ $EMULATOR_STARTED_BY_SCRIPT -eq 1 && -n "$EMULATOR_PID" ]]; then
    echo "  Emulator PID: $EMULATOR_PID"
  fi
  echo "────────────────────────────────────────────────────────"
}

main() {
  log "SeaCheck one-shot dev setup"
  require_cmd curl
  ensure_node_deps
  maybe_preflight
  ensure_emulator
  ensure_metro
  install_android_app
  print_done
}

main
