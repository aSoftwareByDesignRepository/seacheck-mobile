#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Leftover production keys in project-root .env poison Expo CLI (auto-load) for
# every subsequent command. Production persistence belongs in gradle.properties.
if [[ -f .env ]] && grep -qE '^SEACHECK_APP_VARIANT=production' .env; then
  echo "WARN: .env sets SEACHECK_APP_VARIANT=production — stripping (Expo auto-load)." >&2
  tmp="$(mktemp)"
  grep -vE '^SEACHECK_APP_VARIANT=|^NODE_ENV=' .env >"$tmp" || true
  if [[ -s "$tmp" ]]; then
    mv "$tmp" .env
  else
    rm -f .env "$tmp"
  fi
fi

echo "==> Expo native dependency alignment"
npx expo install --check

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests"
npm test -- --passWithNoTests

echo "==> Contrast checks"
npm run a11y:contrast

echo "==> Touch target audit"
npm run a11y:touch

echo "==> i18n EN/DE parity"
node scripts/i18n-parity.mjs

echo "==> F-Droid standalone checks"
bash scripts/fdroid-preflight.sh

required=(
  README.md
  docs/build-it.md
  docs/test-it.md
  fixtures/region-geojson/kiel-bay.geojson
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "Preflight passed."
