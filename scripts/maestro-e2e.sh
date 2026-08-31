#!/usr/bin/env bash
# Run SeaCheck Maestro E2E (download honesty) on a device/emulator.
#
# Usage:
#   bash scripts/maestro-e2e.sh                  # all flows
#   bash scripts/maestro-e2e.sh cancel           # 02-download-cancel-mid
#   bash scripts/maestro-e2e.sh kill             # 03-download-kill-mid
#   SEACHECK_MAESTRO_DEVICE=emulator-5556 bash scripts/maestro-e2e.sh
#
# Env:
#   SEACHECK_MAESTRO_DEVICE  adb serial (must hold lock; default: acquire SeaCheck_Maestro_API_33)
#   SEACHECK_METRO_PORT      Metro port (default 8092)
#   SEACHECK_MAESTRO_CLEAR   1 = pm clear before run (default 1)
#   SEACHECK_MAESTRO_DISABLE_RIVALS  1 = pm disable-user other softwarebydesign apps
#                                    for the run (default 1; re-enabled on exit)
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="de.softwarebydesign.seacheck"
METRO_PORT="${SEACHECK_METRO_PORT:-8092}"
MAESTRO_AVD="${SEACHECK_MAESTRO_AVD:-SeaCheck_Maestro_API_33}"
CLEAR="${SEACHECK_MAESTRO_CLEAR:-1}"
DISABLE_RIVALS="${SEACHECK_MAESTRO_DISABLE_RIVALS:-1}"
ANDROID_HOME="${ANDROID_HOME:-/home/alex/Android/Sdk}"
# shellcheck source=../../scripts/emulator-acquire.sh
source "$APP_ROOT/../scripts/emulator-acquire.sh"
export PATH="${HOME}/.maestro/bin:${PATH}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Packages we disabled for this run (re-enabled via EXIT trap).
DISABLED_RIVALS=()

command -v maestro >/dev/null 2>&1 || die "maestro CLI missing (curl -Ls 'https://get.maestro.mobile.dev' | bash)"
command -v adb >/dev/null 2>&1 || die "adb missing"

pick_device() {
  if [[ -n "${SEACHECK_MAESTRO_DEVICE:-}" ]]; then
    emulator_acquire "$MAESTRO_AVD" --prefer-serial "$SEACHECK_MAESTRO_DEVICE" --boot-if-needed
  else
    emulator_acquire "$MAESTRO_AVD" --boot-if-needed
  fi
  echo "$ANDROID_SERIAL"
}

release_device_lock() {
  emulator_release
}

dump_ui() {
  # Prefer uiautomator — Maestro hierarchy can hang while another Maestro holds the driver.
  adb -s "$DEVICE" shell uiautomator dump /sdcard/seacheck-ui.xml >/dev/null 2>&1 || return 1
  adb -s "$DEVICE" shell cat /sdcard/seacheck-ui.xml 2>/dev/null || true
}

tap_content_desc() {
  local desc="$1"
  local xml bounds
  xml="$(dump_ui)" || return 1
  bounds="$(printf '%s' "$xml" | tr '>' '>\n' | grep -F "content-desc=\"$desc\"" | head -1 | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
  [[ -n "$bounds" ]] || return 1
  # shellcheck disable=SC2086
  set -- $bounds
  local cx cy
  cx=$(( ($1 + $3) / 2 ))
  cy=$(( ($2 + $4) / 2 ))
  adb -s "$DEVICE" shell input tap "$cx" "$cy"
}

tap_text() {
  local text="$1"
  local xml bounds
  xml="$(dump_ui)" || return 1
  bounds="$(printf '%s' "$xml" | tr '>' '>\n' | grep -F "text=\"$text\"" | head -1 | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
  [[ -n "$bounds" ]] || return 1
  # shellcheck disable=SC2086
  set -- $bounds
  local cx cy
  cx=$(( ($1 + $3) / 2 ))
  cy=$(( ($2 + $4) / 2 ))
  adb -s "$DEVICE" shell input tap "$cx" "$cy"
}

stop_rival_apps() {
  local pkg
  while IFS= read -r pkg; do
    [[ -z "$pkg" || "$pkg" == "$APP_ID" ]] && continue
    adb -s "$DEVICE" shell am force-stop "$pkg" >/dev/null 2>&1 || true
  done < <(list_rival_packages)
}

ensure_seacheck_foreground() {
  stop_rival_apps
  adb -s "$DEVICE" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
  launch_deep_link
  sleep 1
  local fg_pkg
  fg_pkg="$(adb -s "$DEVICE" shell dumpsys activity activities 2>/dev/null | tr -d '\r' | awk '/mResumedActivity/{print; exit}' || true)"
  if [[ -n "$fg_pkg" ]] && ! printf '%s' "$fg_pkg" | grep -q "$APP_ID"; then
    log "foreground is not SeaCheck after launch — retry"
    launch_deep_link
  fi
}

list_rival_packages() {
  # -u = all installed (enabled + disabled) so we never miss a rival left disabled by another run.
  adb -s "$DEVICE" shell pm list packages -u 2>/dev/null \
    | sed 's/package://' \
    | grep softwarebydesign \
    | grep -vF "$APP_ID" \
    | grep -v '\.test$' \
    || true
}

disable_rival_apps() {
  [[ "$DISABLE_RIVALS" == "1" ]] || return 0
  DISABLED_RIVALS=()
  local pkg err
  while IFS= read -r pkg; do
    [[ -z "$pkg" || "$pkg" == "$APP_ID" ]] && continue
    adb -s "$DEVICE" shell am force-stop "$pkg" >/dev/null 2>&1 || true
    err="$(adb -s "$DEVICE" shell pm disable-user --user 0 "$pkg" 2>&1)" || true
    if printf '%s' "$err" | grep -qi 'new state: disabled'; then
      DISABLED_RIVALS+=("$pkg")
    elif printf '%s' "$err" | grep -qi 'already disabled'; then
      DISABLED_RIVALS+=("$pkg")
    else
      log "warn: could not disable rival $pkg: ${err:-unknown}"
    fi
  done < <(list_rival_packages)
  if ((${#DISABLED_RIVALS[@]} > 0)); then
    log "disabled rival packages (${#DISABLED_RIVALS[@]}): ${DISABLED_RIVALS[*]}"
  fi
}

enable_rival_apps() {
  # Must never fail the EXIT trap: a successful Maestro run previously exited 1
  # because `${#DISABLED_RIVALS[@]:-0}` is invalid bash ("bad substitution").
  local pkg
  local count="${#DISABLED_RIVALS[@]}"
  for pkg in "${DISABLED_RIVALS[@]}"; do
    [[ -z "$pkg" ]] && continue
    adb -s "$DEVICE" shell pm enable "$pkg" >/dev/null 2>&1 || true
  done
  if ((count > 0)); then
    log "re-enabled rival packages"
  fi
  DISABLED_RIVALS=()
  return 0
}

launch_deep_link() {
  adb -s "$DEVICE" shell am start -W -a android.intent.action.VIEW \
    -d "$DEEP_LINK" -n "${APP_ID}/.MainActivity" >/dev/null 2>&1 || true
}

DEVICE="$(pick_device)"
export ANDROID_SERIAL="$DEVICE"
export SEACHECK_MAESTRO_DEVICE="$DEVICE"
[[ -n "$DEVICE" ]] || die "No adb device. Run: bash .cursor/scripts/emulator-lock.sh status"

FLOW_ARG="${1:-all}"
case "$FLOW_ARG" in
  all)
    FLOWS=(
      "$APP_ROOT/.maestro/02-download-cancel-mid.yaml"
      "$APP_ROOT/.maestro/03-download-kill-mid.yaml"
    )
    ;;
  cancel) FLOWS=("$APP_ROOT/.maestro/02-download-cancel-mid.yaml") ;;
  kill) FLOWS=("$APP_ROOT/.maestro/03-download-kill-mid.yaml") ;;
  onboarding) FLOWS=("$APP_ROOT/.maestro/01-onboarding-skip.yaml") ;;
  probe) FLOWS=("$APP_ROOT/.maestro/00-probe-launch.yaml") ;;
  *) die "Unknown flow '$FLOW_ARG' (all|cancel|kill|onboarding|probe)" ;;
esac

log "device=$DEVICE metro=$METRO_PORT flows=${FLOWS[*]}"

if ! curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status"; then
  die "Metro not running on :${METRO_PORT}. Start with: npx expo start --port ${METRO_PORT} --dev-client"
fi

# Emulator → host Metro (also works when 10.0.2.2 is firewalled).
adb -s "$DEVICE" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true

# Always restore rivals and release emulator lock on exit.
trap 'enable_rival_apps || true; release_device_lock' EXIT

disable_rival_apps
stop_rival_apps

# Ensure debug app present.
if ! adb -s "$DEVICE" shell pm path "$APP_ID" >/dev/null 2>&1; then
  APK="$APP_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
  [[ -f "$APK" ]] || die "App not installed and no debug APK at $APK"
  log "installing $APK"
  adb -s "$DEVICE" install -r "$APK"
fi

DEEP_LINK="exp+seacheck://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A${METRO_PORT}"

grant_runtime_permissions() {
  log "grant runtime permissions"
  for perm in \
    android.permission.ACCESS_FINE_LOCATION \
    android.permission.ACCESS_COARSE_LOCATION \
    android.permission.ACCESS_BACKGROUND_LOCATION \
    android.permission.POST_NOTIFICATIONS \
    android.permission.RECORD_AUDIO
  do
    adb -s "$DEVICE" shell pm grant "$APP_ID" "$perm" >/dev/null 2>&1 || true
  done
}

prepare_fresh_app() {
  if [[ "$CLEAR" == "1" ]]; then
    log "pm clear $APP_ID"
    adb -s "$DEVICE" shell pm clear "$APP_ID" >/dev/null
  fi
  grant_runtime_permissions
}

wait_for_js_ui() {
  log "deep-link load"
  adb -s "$DEVICE" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
  stop_rival_apps
  launch_deep_link

  local ready=0
  local i
  for i in $(seq 1 90); do
    if ! adb -s "$DEVICE" get-state 2>/dev/null | grep -q device; then
      die "device $DEVICE disconnected while waiting for JS UI (iter $i)"
    fi
    stop_rival_apps
    local fg_pkg
    fg_pkg="$(adb -s "$DEVICE" shell dumpsys activity activities 2>/dev/null | tr -d '\r' | awk '/mResumedActivity/{print; exit}' || true)"
    if [[ -n "$fg_pkg" ]] && ! printf '%s' "$fg_pkg" | grep -q "$APP_ID"; then
      log "foreground is not SeaCheck — re-launch (iter $i)"
      launch_deep_link
    fi
    local xml
    xml="$(dump_ui || true)"
    if printf '%s' "$xml" | grep -q "package=\"$APP_ID\"" && \
       printf '%s' "$xml" | grep -q 'resource-id="screen.onboarding"\|resource-id="tab.map"\|resource-id="tab.downloads"\|resource-id="onboarding.'; then
      ready=1
      log "JS UI ready (iter $i)"
      break
    fi
    if printf '%s' "$xml" | grep -q "package=\"$APP_ID\"" && \
       printf '%s' "$xml" | grep -Eqi 'problem loading|ConnectException|Failed to connect to|Could not connect to development'; then
      die "Dev Launcher failed to reach Metro on 10.0.2.2:${METRO_PORT} (also reversed tcp:${METRO_PORT})"
    fi
    if printf '%s' "$xml" | grep -q "package=\"$APP_ID\"" && printf '%s' "$xml" | grep -q 'text="Continue"'; then
      log "dismiss Continue (iter $i)"
      tap_text "Continue" || true
    elif printf '%s' "$xml" | grep -q "package=\"$APP_ID\"" && printf '%s' "$xml" | grep -q 'content-desc="Close"'; then
      log "dismiss Expo tools Close (iter $i)"
      tap_content_desc "Close" || true
    elif printf '%s' "$xml" | grep -q 'Bundling\|Loading development'; then
      log "bundling (iter $i)"
    else
      log "waiting for JS (iter $i)"
    fi
    if (( i % 15 == 0 )); then
      log "re-launch deep link (iter $i)"
      launch_deep_link
    fi
    sleep 2
  done
  if [[ "$ready" != "1" ]]; then
    log "UI dump (timeout):"
    dump_ui | tr '>' '>\n' | grep -E 'package=|text=|content-desc=|resource-id=' | head -80 || true
    die "Timed out waiting for SeaCheck JS UI on $DEVICE"
  fi
}

run_maestro_flow() {
  local flow="$1"
  local flow_name
  flow_name="$(basename "$flow")"
  log "maestro flow: $flow_name"
  prepare_fresh_app
  wait_for_js_ui
  ensure_seacheck_foreground
  set +e
  maestro --device "$DEVICE" test "$flow"
  local rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    log "UI dump (maestro fail: $flow_name):"
    dump_ui | tr '>' '>\n' | grep -E 'package=|text=|content-desc=|resource-id=' | head -80 || true
    die "maestro test failed for $flow_name (exit $rc)"
  fi
}

log "maestro test (${#FLOWS[@]} flow(s), serial — one device server at a time)"
for flow in "${FLOWS[@]}"; do
  run_maestro_flow "$flow"
done
log "OK"
exit 0
