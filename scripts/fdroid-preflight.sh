#!/usr/bin/env bash
# Validates F-Droid / standalone-repo assumptions (no monorepo ../shared paths).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Metro config loads in standalone repo"
SEACHECK_APP_VARIANT=production NODE_ENV=production node -e "require('./metro.config.js')"

if grep -qE '\.\./shared/' metro.config.js 2>/dev/null; then
  echo "ERROR: metro.config.js must not require ../shared/ (F-Droid clones this repo alone)" >&2
  exit 1
fi

echo "==> F-Droid build scripts present"
required=(
  scripts/fdroid-init.gradle
  scripts/fdroid-strip-node-prebuilts.sh
  scripts/patch-expo-constants-env.sh
  scripts/ensure-android-local-properties.sh
  docs/fdroid/de.softwarebydesign.seacheck.yml
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "==> Production app.config (SEACHECK_APP_VARIANT=production)"
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo config --type public >/dev/null

echo "F-Droid preflight passed."
