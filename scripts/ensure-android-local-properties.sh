#!/usr/bin/env bash
# Writes android/local.properties (sdk.dir) for Gradle. Safe to re-run after expo prebuild --clean.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
PROPS="$ANDROID_DIR/local.properties"

resolve_sdk() {
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    printf '%s' "$ANDROID_HOME"
    return 0
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    printf '%s' "$ANDROID_SDK_ROOT"
    return 0
  fi
  local default="$HOME/Android/Sdk"
  if [[ -d "$default" ]]; then
    printf '%s' "$default"
    return 0
  fi
  return 1
}

SDK="$(resolve_sdk || true)"
if [[ -z "$SDK" ]]; then
  echo "ERROR: Android SDK not found." >&2
  echo "Set ANDROID_HOME to your SDK path, e.g. export ANDROID_HOME=\$HOME/Android/Sdk" >&2
  exit 1
fi

[[ -d "$ANDROID_DIR" ]] || {
  echo "ERROR: $ANDROID_DIR missing — run: npx expo prebuild --platform android" >&2
  exit 1
}

printf 'sdk.dir=%s\n' "$SDK" >"$PROPS"
echo "Wrote $PROPS (sdk.dir=$SDK)"
