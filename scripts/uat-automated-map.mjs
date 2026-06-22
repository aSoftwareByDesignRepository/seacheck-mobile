#!/usr/bin/env node
/**
 * Maps UAT checklist IDs to automated gates (plan §14 + docs/UAT-CHECKLIST.md).
 * Fails when a referenced test file or gate script is missing.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const MATRIX = [
  { id: 'A4', gate: 'server:uat-server-scenarios (token revoke)', paths: ['scripts/uat-server-scenarios.sh'] },
  { id: 'A5', gate: 'unit:session (biometric unlock)', paths: ['src/__tests__/session.test.ts'] },
  { id: 'B1-B3', gate: 'unit:playback + component:player chrome', paths: ['src/__tests__/playbackDecision.test.ts', 'src/__tests__/queueNavigation.test.ts'] },
  { id: 'B5', gate: 'unit:queue merge/navigation', paths: ['src/__tests__/queueMerge.test.ts', 'src/__tests__/queueNavigation.test.ts'] },
  { id: 'C1-C3', gate: 'unit:progress outbox/merge + playbackSync', paths: ['src/__tests__/progressOutbox.test.ts', 'src/__tests__/progressMerge.test.ts', 'src/__tests__/queueOutbox.test.ts', 'src/sync/playbackSync.ts'] },
  { id: 'D1-D2', gate: 'unit:buildTrackSource + download labels', paths: ['src/__tests__/buildTrackSource.test.ts', 'src/__tests__/downloadLabels.test.ts'] },
  { id: 'D3', gate: 'unit:playbackBlocked', paths: ['src/__tests__/playbackBlocked.test.ts'] },
  { id: 'D4', gate: 'unit:download store quota', paths: ['src/downloads/downloadStore.ts'] },
  { id: 'E1', gate: 'unit:browseFilters + fetchAllTracks', paths: ['src/__tests__/browseFilters.test.ts', 'src/__tests__/fetchAllTracks.test.ts'] },
  { id: 'E2', gate: 'component:DownloadAllBar + unit:estimateBytes', paths: ['src/__tests__/DownloadAllBar.test.tsx', 'src/__tests__/estimateBytes.test.ts'] },
  { id: 'E3-E4', gate: 'unit:queue actions', paths: ['src/__tests__/queueMerge.test.ts'] },
  { id: 'F1', gate: 'component:a11y labels', paths: ['src/__tests__/FavoriteActionButton.test.tsx', 'src/__tests__/FilterChip.test.tsx'] },
  { id: 'F2', gate: 'a11y:touch-target audit', paths: ['scripts/a11y-touch-target-audit.mjs'] },
  { id: 'F3', gate: 'i18n parity', paths: ['scripts/i18n-parity.mjs'] },
  { id: 'F4', gate: 'a11y:contrast', paths: ['scripts/contrast-check.mjs'] },
  { id: 'G1', gate: 'component:FavoriteActionButton', paths: ['src/__tests__/FavoriteActionButton.test.tsx'] },
  { id: 'G2', gate: 'settings listened threshold (manual sign-off)', paths: ['src/screens/SettingsScreen.tsx'] },
  { id: 'G3', gate: 'unit:downloadCleanup', paths: ['src/__tests__/downloadCleanup.test.ts'] },
  { id: 'G4', gate: 'unit:librarySync + settings last sync UI', paths: ['src/__tests__/librarySync.test.ts', 'src/screens/SettingsScreen.tsx'] },
  { id: 'E2E', gate: 'detox mock + smoke/home/browse', paths: ['e2e/smoke.e2e.ts', 'e2e/home.e2e.ts', 'e2e/browse.e2e.ts', 'src/e2e/mockApi.ts'] },
];

let fail = 0;

console.log('UAT automated coverage matrix');
console.log('ID\tGate\tStatus');
for (const row of MATRIX) {
  const missing = row.paths.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  const status = missing.length === 0 ? 'OK' : `MISSING ${missing.join(', ')}`;
  if (missing.length > 0) fail += 1;
  console.log(`${row.id}\t${row.gate}\t${status}`);
}

if (fail > 0) {
  process.exit(1);
}

console.log('UAT automated mapping gate passed.');
