#!/usr/bin/env bash
# Persists production Expo config env for Gradle (:expo-constants:createExpoConfig).
# F-Droid runs `npm ci --omit=dev`, so expo-dev-client is absent; Gradle must still
# evaluate app.config.ts as production (see app.config.ts + patch-expo-constants-env.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT="${SEACHECK_APP_VARIANT:-production}"

if [[ "${1:-}" != "--production" && "${SEACHECK_APP_VARIANT:-}" != "production" ]]; then
  echo "write-android-build-env: skipped (not a production build)" >&2
  exit 0
fi

ENV_FILE="$ROOT/.env"
{
  printf 'SEACHECK_APP_VARIANT=%s\n' "$VARIANT"
  printf 'NODE_ENV=production\n'
} >"$ENV_FILE"
echo "write-android-build-env: wrote $ENV_FILE"

GRADLE_PROPS="$ROOT/android/gradle.properties"
if [[ -f "$GRADLE_PROPS" ]]; then
  if [[ -n "$(tail -c1 "$GRADLE_PROPS" 2>/dev/null || true)" ]]; then
    printf '\n' >>"$GRADLE_PROPS"
  fi
  sed -i '/^SEACHECK_APP_VARIANT=/d' "$GRADLE_PROPS"
  printf 'SEACHECK_APP_VARIANT=%s\n' "$VARIANT" >>"$GRADLE_PROPS"
  echo "write-android-build-env: set SEACHECK_APP_VARIANT in $GRADLE_PROPS"
fi
