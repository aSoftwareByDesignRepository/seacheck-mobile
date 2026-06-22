#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

required=(
  README.md
  docs/build-it.md
  docs/test-it.md
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "Preflight passed."
