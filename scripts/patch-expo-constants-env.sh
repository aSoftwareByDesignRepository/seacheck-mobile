#!/usr/bin/env bash
# Injects SEACHECK_APP_VARIANT and NODE_ENV into expo-constants createExpoConfig (Gradle Exec).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/node_modules/expo-constants/scripts/get-app-config-android.gradle"
MARKER="SEACHECK_EXPO_CONFIG_ENV"

[[ -f "$FILE" ]] || {
  echo "patch-expo-constants-env: $FILE not found (skip)" >&2
  exit 0
}

if grep -q "$MARKER" "$FILE"; then
  echo "patch-expo-constants-env: already patched"
  exit 0
fi

SNIPPET='    // SEACHECK_EXPO_CONFIG_ENV — pass production env into getAppConfig.js (F-Droid: npm ci --omit=dev)
    def seacheckNodeEnv = System.getenv("NODE_ENV")
    if (seacheckNodeEnv == null || seacheckNodeEnv.isEmpty()) {
      seacheckNodeEnv = project.findProperty("NODE_ENV") ?: "production"
    }
    environment "NODE_ENV", seacheckNodeEnv.toString()
    def seacheckAppVariant = System.getenv("SEACHECK_APP_VARIANT")
    if (seacheckAppVariant == null || seacheckAppVariant.isEmpty()) {
      seacheckAppVariant = project.findProperty("SEACHECK_APP_VARIANT")
    }
    if (seacheckAppVariant != null && !seacheckAppVariant.toString().isEmpty()) {
      environment "SEACHECK_APP_VARIANT", seacheckAppVariant.toString()
    }
'

tmp="$(mktemp)"
awk -v snippet="$SNIPPET" '
  /tasks\.register\('\''createExpoConfig'\''/ { in_task=1 }
  in_task && /^    workingDir projectRoot$/ && !done {
    print $0
    print snippet
    done=1
    next
  }
  { print }
' "$FILE" >"$tmp"
mv "$tmp" "$FILE"

if ! grep -q "$MARKER" "$FILE"; then
  echo "patch-expo-constants-env: ERROR — failed to insert env block" >&2
  exit 1
fi

echo "patch-expo-constants-env: patched get-app-config-android.gradle"
