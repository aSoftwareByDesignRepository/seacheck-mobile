#!/usr/bin/env bash
# Unit / static gates for GitHub Actions + local CI parity (no emulator).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CI="${CI:-true}"
export NODE_ENV="${NODE_ENV:-test}"

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests (no forceExit)"
npm test -- --ci --no-coverage

echo "==> Safety/offline mutations"
npm run mutate:core

echo "==> Contrast (WCAG)"
npm run a11y:contrast

echo "==> Touch targets"
npm run a11y:touch

echo "==> i18n parity"
npm run i18n:parity

echo "ci-unit passed."
