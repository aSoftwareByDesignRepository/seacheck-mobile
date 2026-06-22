#!/usr/bin/env bash
# Full automated UAT gate: preflight + server scenarios + sign-off report.
# Optional device E2E: RUN_E2E=1 (requires android/ from expo prebuild + emulator).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="${UAT_LOG:-/tmp/audiocheck-uat-run.log}"
: >"$LOG"

echo "==> AudioCheck UAT run (log: $LOG)"

{
  echo "==> Preflight"
  npm run preflight

  echo "==> UAT server scenarios"
  bash scripts/uat-server-scenarios.sh

  if [[ "${RUN_E2E:-}" == "1" ]]; then
    echo "==> Detox E2E"
    if [[ ! -d android ]]; then
      echo "FAIL: android/ missing — run: npx expo prebuild --platform android"
      exit 1
    fi
    npm run e2e:build
    npm run e2e:test
  else
    echo "SKIP E2E: set RUN_E2E=1 after prebuild + emulator to run Detox"
  fi
} 2>&1 | tee -a "$LOG"

node scripts/uat-report.mjs "$LOG"
echo "UAT run complete. See docs/UAT-SIGNOFF-REPORT.md"
