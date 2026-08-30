/**
 * Mutation gauntlet for SeaCheck maritime safety + offline download exclusivity.
 *
 * Mutates source one fail-open change at a time, expects unit tests to FAIL
 * (mutant killed), restores regardless of outcome. Crash-safe backups under
 * scripts/.mutation-backups/.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backupDir = path.join(__dirname, '.mutation-backups');
const manifestPath = path.join(backupDir, 'manifest.json');

const testCmd = [
  'npx',
  'jest',
  '--runInBand',
  '--testPathPattern=gpsFilter|fixQuality|processLocationAlarms|connectivity|downloadNetwork|downloadPolicy|downloadCoordinator|beginDownloadSession|offlinePackIndex|regionPacks|maydayMessage|copyMaydayClipboard|parsePersistedBoolean',
];

const mutations = [
  {
    name: 'gps-outlier-never-rejects',
    file: 'src/lib/geo/gpsFilter.ts',
    search:
      "  if (isFixOutlier(previous, next)) {\n    return { accepted: false, reason: 'outlier' };\n  }",
    replace:
      "  if (false && isFixOutlier(previous, next)) {\n    return { accepted: false, reason: 'outlier' }; /* mutated */\n  }",
  },
  {
    name: 'gps-gap-keeps-stale-baseline',
    file: 'src/lib/geo/gpsFilter.ts',
    search: '  if (nextTimestamp - previous.timestamp > maxGapMs) return null;',
    replace: '  if (false && nextTimestamp - previous.timestamp > maxGapMs) return null; /* mutated */',
  },
  {
    name: 'safety-unknown-accuracy-ok',
    file: 'src/lib/geo/fixQuality.ts',
    search:
      '  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM)) return false;\n  return fix.accuracyM <= maxAccuracyM;\n}',
    replace:
      '  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM)) return true; /* mutated */\n  return fix.accuracyM <= maxAccuracyM;\n}',
  },
  {
    name: 'anchor-drag-ignores-accuracy',
    file: 'src/lib/alarms/processLocationAlarms.ts',
    search:
      'function isAccuracyTrustworthyForDrag(accuracyM: number | null | undefined): boolean {\n  if (accuracyM == null || !Number.isFinite(accuracyM)) return false;\n  return accuracyM <= MAX_ALARM_ACCURACY_M;\n}',
    replace:
      'function isAccuracyTrustworthyForDrag(accuracyM: number | null | undefined): boolean {\n  return true; /* mutated: always trustworthy */\n}',
  },
  {
    name: 'anchor-defer-gap-ignored',
    file: 'src/lib/alarms/processLocationAlarms.ts',
    search:
      '  if (anchorAlarm?.active && input.deferAnchorDragEvaluation) {\n    // GPS just recovered — do not compare against pre-outage position on a single fix.\n    runtime.anchorSogStreak = 0;\n    runtime.anchorRadiusStreak = 0;\n  } else if (anchorAlarm?.active && !isAccuracyTrustworthyForDrag(input.fix.accuracyM)) {',
    replace:
      '  if (false && anchorAlarm?.active && input.deferAnchorDragEvaluation) {\n    // GPS just recovered — do not compare against pre-outage position on a single fix.\n    runtime.anchorSogStreak = 0;\n    runtime.anchorRadiusStreak = 0;\n  } else if (anchorAlarm?.active && !isAccuracyTrustworthyForDrag(input.fix.accuracyM)) {',
  },
  {
    name: 'download-offline-allowed',
    file: 'src/lib/network/downloadNetwork.ts',
    search:
      '  if (state.isConnected === false) {\n    throw new Error(t(\'downloads.errorOffline\'));\n  }',
    replace:
      '  if (false && state.isConnected === false) {\n    throw new Error(t(\'downloads.errorOffline\')); /* mutated */\n  }',
  },
  {
    name: 'download-wifi-netinfo-fail-open',
    file: 'src/lib/network/downloadPolicy.ts',
    search:
      "  } catch {\n    const proceeded = await cellularConfirm();\n    return proceeded ? { ok: true } : { ok: false, reason: 'cancelled' };\n  }",
    replace:
      "  } catch {\n    return { ok: true }; /* mutated: silent allow when NetInfo fails */\n  }",
  },
  {
    name: 'download-wifi-offline-as-cellular',
    file: 'src/lib/network/downloadPolicy.ts',
    search:
      "  if (state.isConnected === false) {\n    return { ok: false, reason: 'offline' };\n  }",
    replace:
      "  if (false && state.isConnected === false) {\n    return { ok: false, reason: 'offline' }; /* mutated */\n  }",
  },
  {
    name: 'download-parallel-allowed',
    file: 'src/lib/offline/downloadCoordinator.ts',
    search:
      '  tryBegin(regionId: string): number | null {\n    if (this.activeRegionId != null && this.activeRegionId !== regionId) return null;\n    if (this.activeRegionId === regionId && !this.preflightOnly) return null;',
    replace:
      '  tryBegin(regionId: string): number | null {\n    if (false && this.activeRegionId != null && this.activeRegionId !== regionId) return null;\n    if (false && this.activeRegionId === regionId && !this.preflightOnly) return null;',
  },
  {
    name: 'stale-callback-accepted',
    file: 'src/lib/offline/downloadCoordinator.ts',
    search:
      '  isStale(regionId: string, token: number): boolean {\n    return this.sessions.get(regionId) !== token;\n  }',
    replace:
      '  isStale(regionId: string, token: number): boolean {\n    return false; /* mutated: never stale */\n  }',
  },
  {
    name: 'persist-index-accepts-arrays',
    file: 'src/lib/offline/offlinePackIndex.ts',
    search: '  if (!raw || typeof raw !== \'object\' || Array.isArray(raw)) return {};',
    replace: '  if (!raw || typeof raw !== \'object\') return {}; /* mutated: arrays accepted */',
  },
  {
    name: 'tile-budget-disabled',
    file: 'src/map/regionPackValidation.ts',
    search:
      '  if (tileCount > MAX_TILE_COUNT) {\n    return { ok: false, tileCount, estimatedKb, sizeLabel, limit: MAX_TILE_COUNT };\n  }',
    replace:
      '  if (false && tileCount > MAX_TILE_COUNT) {\n    return { ok: false, tileCount, estimatedKb, sizeLabel, limit: MAX_TILE_COUNT };\n  }',
  },
  {
    name: 'mmsi-always-valid',
    file: 'src/lib/emergency/maydayMessage.ts',
    search: '  return digits.length === MMSI_LEN && /^\\d{9}$/.test(digits);',
    replace: '  return true; /* mutated: any MMSI ok */',
  },
  {
    name: 'mayday-invents-fresh',
    file: 'src/lib/emergency/copyMaydayClipboard.ts',
    search:
      '  if (fix && isSafetyFixOk(fix)) {\n    return { fix, quality: \'fresh\' };\n  }',
    replace:
      '  if (fix) {\n    return { fix, quality: \'fresh\' }; /* mutated: skip safety grade */\n  }',
  },
  {
    name: 'persist-bool-truthy-strings',
    file: 'src/lib/settings/parsePersistedBoolean.ts',
    search: '  return typeof value === \'boolean\' ? value : fallback;',
    replace: '  return value != null ? Boolean(value) : fallback; /* mutated */',
  },
  {
    name: 'online-ops-unknown-ok',
    file: 'src/lib/network/connectivity.ts',
    search:
      'export function isEffectivelyOnline(state: Pick<NetInfoState, \'isConnected\' | \'isInternetReachable\'>): boolean {\n  return state.isConnected === true && state.isInternetReachable === true;\n}',
    replace:
      'export function isEffectivelyOnline(state: Pick<NetInfoState, \'isConnected\' | \'isInternetReachable\'>): boolean {\n  return state.isConnected === true; /* mutated: ignore reachability */\n}',
  },
];

function runTests() {
  const r = spawnSync(testCmd[0], testCmd.slice(1), {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', SEACHECK_MUTATION_RUN: '1' },
  });
  return r.status === 0;
}

function restoreLeftoverBackups() {
  if (!fs.existsSync(manifestPath)) {
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const entry of manifest) {
    const backupFile = path.join(backupDir, entry.backup);
    if (fs.existsSync(backupFile)) {
      fs.writeFileSync(path.join(root, entry.file), fs.readFileSync(backupFile, 'utf8'));
      console.warn(`Repaired leftover mutant from a crashed run: ${entry.file}`);
    }
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
}

function assertCleanBaselineSources() {
  const problems = [];
  for (const mut of mutations) {
    const full = path.join(root, mut.file);
    if (!fs.existsSync(full)) {
      problems.push(`${mut.name}: file missing (${mut.file})`);
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    if (!content.includes(mut.search)) {
      const leaked =
        mut.replace && content.includes(mut.replace)
          ? ' — the MUTATED code is present (leaked mutant!)'
          : '';
      problems.push(`${mut.name}: original code not found in ${mut.file}${leaked}`);
    }
  }
  if (problems.length > 0) {
    console.error('Source tree does not match mutation baselines:');
    for (const p of problems) {
      console.error(`  - ${p}`);
    }
    console.error('Restore the original code (e.g. `git diff` the listed files) before mutating.');
    process.exit(1);
  }
}

function backupBeforeMutation(mut, original) {
  fs.mkdirSync(backupDir, { recursive: true });
  const backupName = `${mut.name}.orig`;
  fs.writeFileSync(path.join(backupDir, backupName), original);
  fs.writeFileSync(manifestPath, JSON.stringify([{ file: mut.file, backup: backupName }]));
}

function clearBackup() {
  fs.rmSync(backupDir, { recursive: true, force: true });
}

function main() {
  console.log('SeaCheck safety/offline core mutations');
  restoreLeftoverBackups();
  assertCleanBaselineSources();
  if (!runTests()) {
    console.error('Baseline tests failed — aborting mutations');
    process.exit(1);
  }
  console.log('Baseline: PASS');

  let killed = 0;
  let survived = 0;
  /** @type {{ file: string, original: string } | null} */
  let active = null;

  const restoreActive = () => {
    if (active) {
      fs.writeFileSync(path.join(root, active.file), active.original);
      clearBackup();
      active = null;
    }
  };

  process.on('SIGINT', () => {
    restoreActive();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    restoreActive();
    process.exit(143);
  });
  process.on('uncaughtException', (err) => {
    restoreActive();
    console.error(err);
    process.exit(1);
  });

  for (const mut of mutations) {
    const abs = path.join(root, mut.file);
    const original = fs.readFileSync(abs, 'utf8');
    backupBeforeMutation(mut, original);
    fs.writeFileSync(abs, original.replace(mut.search, mut.replace));
    active = { file: mut.file, original };
    try {
      const passed = runTests();
      if (passed) {
        console.error(`SURVIVED: ${mut.name}`);
        survived += 1;
      } else {
        console.log(`Killed: ${mut.name}`);
        killed += 1;
      }
    } finally {
      restoreActive();
    }
  }

  console.log(`\nResult: ${killed} killed, ${survived} survived of ${mutations.length}`);
  if (survived > 0) {
    process.exit(1);
  }
}

module.exports = { mutations };

if (require.main === module) {
  main();
}
