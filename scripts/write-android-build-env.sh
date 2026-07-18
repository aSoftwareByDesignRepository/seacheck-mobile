#!/usr/bin/env bash
# Persists production Expo config env for Gradle (:expo-constants:createExpoConfig).
# F-Droid runs `npm ci --omit=dev`, so expo-dev-client is absent; Gradle must still
# evaluate app.config.ts as production (see app.config.ts + patch-expo-constants-env.sh).
#
# IMPORTANT: Do NOT write project-root `.env` — Expo CLI auto-loads it for every
# command (preflight, start, tests) and permanently poisons local/dev workflows.
# Persistence is gradle.properties + Exec environment (patch-expo-constants-env.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT="${SEACHECK_APP_VARIANT:-production}"

if [[ "${1:-}" != "--production" && "${SEACHECK_APP_VARIANT:-}" != "production" ]]; then
  echo "write-android-build-env: skipped (not a production build)" >&2
  exit 0
fi

GRADLE_PROPS="$ROOT/android/gradle.properties"
if [[ ! -f "$GRADLE_PROPS" ]]; then
  echo "write-android-build-env: ERROR — $GRADLE_PROPS missing (run expo prebuild first)" >&2
  exit 1
fi

if [[ -n "$(tail -c1 "$GRADLE_PROPS" 2>/dev/null || true)" ]]; then
  printf '\n' >>"$GRADLE_PROPS"
fi
sed -i '/^SEACHECK_APP_VARIANT=/d' "$GRADLE_PROPS"
sed -i '/^NODE_ENV=/d' "$GRADLE_PROPS"
printf 'SEACHECK_APP_VARIANT=%s\n' "$VARIANT" >>"$GRADLE_PROPS"
printf 'NODE_ENV=production\n' >>"$GRADLE_PROPS"
echo "write-android-build-env: set SEACHECK_APP_VARIANT + NODE_ENV in $GRADLE_PROPS"

# Migrate away from a historically written project-root .env that Expo auto-loads.
ENV_FILE="$ROOT/.env"
if [[ -f "$ENV_FILE" ]] && grep -qE '^SEACHECK_APP_VARIANT=|^NODE_ENV=' "$ENV_FILE"; then
  tmp="$(mktemp)"
  grep -vE '^SEACHECK_APP_VARIANT=|^NODE_ENV=' "$ENV_FILE" >"$tmp" || true
  if [[ -s "$tmp" ]]; then
    mv "$tmp" "$ENV_FILE"
    echo "write-android-build-env: stripped SEACHECK/NODE_ENV keys from $ENV_FILE (Expo auto-load)" >&2
  else
    rm -f "$ENV_FILE" "$tmp"
    echo "write-android-build-env: removed leftover $ENV_FILE (Expo auto-load poison)" >&2
  fi
fi
