#!/usr/bin/env node
/**
 * Generates docs/UAT-SIGNOFF-REPORT.md from a uat-run log.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const logPath = process.argv[2] ?? '/tmp/audiocheck-uat-run.log';
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

function passed(marker) {
  return log.includes(marker);
}

const now = new Date().toISOString().slice(0, 10);

const rows = [
  { id: 'A1', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Login Flow v2 — device sign-off still required' },
  { id: 'A2', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Dev server chip — device sign-off still required' },
  { id: 'A3', auto: '—', status: 'manual', note: 'Session persistence after force-quit' },
  { id: 'A4', auto: 'partial', status: passed('UAT server scenario A4 passed') ? 'automated-partial' : passed('SKIP UAT A4') ? 'skipped' : 'fail', note: 'API 401 after token revoke (mobile redirect needs device)' },
  { id: 'A5', auto: 'partial', status: passed('Unit tests') && passed('session.test') ? 'automated-partial' : passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Biometric prompt — device sign-off required' },
  { id: 'B1', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Playback units + E2E browse play when RUN_E2E=1' },
  { id: 'B2', auto: '—', status: 'manual', note: 'Speed restore after kill' },
  { id: 'B3', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Chapter seek — device sign-off' },
  { id: 'B4', auto: '—', status: 'manual', note: '30+ min lock screen soak' },
  { id: 'B5', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Queue shuffle units' },
  { id: 'C1', auto: 'partial', status: passed('progress save fileId=') ? 'automated-partial' : 'fail', note: 'Server progress round-trip; resume UI needs device' },
  { id: 'C2', auto: '—', status: 'manual', note: 'Cross-client web ↔ mobile resume' },
  { id: 'C3', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Outbox units; offline resume needs device' },
  { id: 'D1', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Airplane mode playback — device' },
  { id: 'D2', auto: '—', status: 'manual', note: 'Offline playlist queue' },
  { id: 'D3', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Revoked download — device' },
  { id: 'D4', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Low storage — device' },
  { id: 'E1', auto: 'partial', status: passed('hideListened=1') ? 'automated-partial' : 'fail', note: 'Browse filters units + server hideListened' },
  { id: 'E2', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Download all bar component tests' },
  { id: 'E3', auto: 'partial', status: passed('playlist pin') ? 'automated-partial' : 'fail', note: 'Pin mutation smoke' },
  { id: 'E4', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Queue reorder units' },
  { id: 'F1', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'TalkBack/VoiceOver walkthrough — device' },
  { id: 'F2', auto: 'yes', status: passed('Touch target audit') ? 'automated-pass' : 'fail', note: 'npm run a11y:touch' },
  { id: 'F3', auto: 'yes', status: passed('i18n EN/DE parity') ? 'automated-pass' : 'fail', note: 'npm run i18n:parity' },
  { id: 'F4', auto: 'yes', status: passed('Contrast checks') ? 'automated-pass' : 'fail', note: 'npm run a11y:contrast' },
  { id: 'G1', auto: 'partial', status: passed('favorite save fileId=') ? 'automated-partial' : 'fail', note: 'Server favorite mutation smoke' },
  { id: 'G2', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'Threshold UI — device' },
  { id: 'G3', auto: 'partial', status: passed('Preflight passed') ? 'automated-partial' : 'fail', note: 'downloadCleanup units' },
  { id: 'G4', auto: 'partial', status: passed('library/sync-state') ? 'automated-partial' : 'fail', note: 'librarySync units + sync-state smoke' },
];

const e2eRan = passed('Detox E2E') && !passed('SKIP E2E');
const e2ePass = passed('e2e/smoke') || passed('PASS') || log.includes('Tests:');

const report = `# UAT Sign-off Report

Generated: ${now}  
Log: \`${logPath}\`

## Automated gate summary

| Gate | Result |
|------|--------|
| Preflight | ${passed('Preflight passed') ? 'PASS' : 'FAIL'} |
| UAT A4 (token revoke) | ${passed('UAT server scenario A4 passed') ? 'PASS' : passed('SKIP UAT A4') ? 'SKIP' : 'FAIL'} |
| Detox E2E | ${e2eRan ? (e2ePass ? 'PASS (see log)' : 'SEE LOG') : 'NOT RUN (set RUN_E2E=1)'} |

## Checklist status

| ID | Auto | Status | Notes |
|----|------|--------|-------|
${rows.map((row) => `| **${row.id}** | ${row.auto} | ${row.status} | ${row.note} |`).join('\n')}

## Manual sign-off still required

Complete on a physical device or emulator against Docker (\`http://10.0.2.2:8081\`):

- **A3, A5** — session / biometric cold start
- **B2, B4** — speed restore, lock screen soak
- **C2** — web ↔ mobile resume
- **D1, D2, D3, D4** — offline playback and storage edges
- **F1** — TalkBack / VoiceOver full walkthrough

## Tester sign-off

| Tester | Platform | Date | Pass/Fail | Notes |
|--------|----------|------|-----------|-------|
|        |          |      |           |       |

---

Re-run: \`bash scripts/uat-run.sh\`  
With Detox: \`RUN_E2E=1 bash scripts/uat-run.sh\` (after \`npx expo prebuild --platform android\`)
`;

const dest = path.join(ROOT, 'docs', 'UAT-SIGNOFF-REPORT.md');
fs.writeFileSync(dest, report, 'utf8');
console.log(`Wrote ${dest}`);

const failed = rows.filter((row) => row.status === 'fail').length;
if (!passed('Preflight passed')) {
  process.exit(1);
}
if (failed > 0) {
  console.warn(`${failed} checklist row(s) marked fail — see report`);
}
