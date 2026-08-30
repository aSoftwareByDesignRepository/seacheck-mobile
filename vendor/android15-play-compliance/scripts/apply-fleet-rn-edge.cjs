#!/usr/bin/env node
/**
 * Wire RN edge-to-edge patch into every Check app package.json + release scripts.
 * Idempotent — safe to re-run after apply-fleet.
 */
const fs = require('fs');
const path = require('path');
const fleetProfiles = require('../src/fleetProfiles');

const mobileRoot = path.resolve(__dirname, '../../..');
const PATCH_SCRIPT = '../shared/android15-play-compliance/scripts/patch-rn-edge-to-edge.cjs';
const PREFLIGHT_BLOCK = `echo "==> Android 15 / Play: patch RN edge-to-edge deprecated Window APIs"
npm run patch:rn-edge
`;
const BUNDLE_BLOCK = `echo "==> Android 15 / Play: ensure RN edge-to-edge sources are patched"
npm run patch:rn-edge

`;

/** Apps with the shared plugin but outside fleetProfiles (maintenance / inventory). */
const EXTRA_APPS = ['maintenancecheck', 'inventorycheck'];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

function ensurePackageScripts(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return { changed: false, reason: 'no-package' };
  const pkg = readJson(pkgPath);
  pkg.scripts = pkg.scripts || {};
  let changed = false;
  const patchCmd = `node ${PATCH_SCRIPT}`;
  if (pkg.scripts['patch:rn-edge'] !== patchCmd) {
    pkg.scripts['patch:rn-edge'] = patchCmd;
    changed = true;
  }
  if (pkg.scripts.postinstall !== patchCmd) {
    pkg.scripts.postinstall = patchCmd;
    changed = true;
  }
  if (changed) writeJson(pkgPath, pkg);
  return { changed };
}

function ensurePreflight(appDir) {
  const preflight = path.join(appDir, 'scripts/preflight.sh');
  if (!fs.existsSync(preflight)) return { changed: false, skip: true };
  let text = fs.readFileSync(preflight, 'utf8');
  if (/patch:rn-edge|patch-rn-edge-to-edge/.test(text)) {
    return { changed: false };
  }
  const anchor = text.includes('echo "==> Typecheck"')
    ? 'echo "==> Typecheck"'
    : text.includes('echo "==> Unit tests"')
      ? 'echo "==> Unit tests"'
      : null;
  if (!anchor) {
    text = `${PREFLIGHT_BLOCK}\n${text}`;
  } else {
    text = text.replace(anchor, `${PREFLIGHT_BLOCK}\n${anchor}`);
  }
  fs.writeFileSync(preflight, text);
  return { changed: true };
}

function ensureAndroidBundle(appDir) {
  const bundle = path.join(appDir, 'scripts/android-bundle.sh');
  if (!fs.existsSync(bundle)) return { changed: false, skip: true };
  let text = fs.readFileSync(bundle, 'utf8');
  if (/patch:rn-edge|patch-rn-edge-to-edge|patchReactNativeNodeModules/.test(text)) {
    // Normalize legacy inline node -e to npm run patch:rn-edge when only inline present
    if (!/patch:rn-edge/.test(text) && /patchReactNativeNodeModules/.test(text)) {
      text = text.replace(
        /echo "==> Android 15 \/ Play: ensure RN edge-to-edge sources are patched"\nnode -e "[\s\S]*?"\n\n/,
        BUNDLE_BLOCK,
      );
      if (/patch:rn-edge/.test(text)) {
        fs.writeFileSync(bundle, text);
        return { changed: true, normalized: true };
      }
    }
    return { changed: false };
  }
  const insertBefore = text.includes('echo "==> Building release AAB"')
    ? 'echo "==> Building release AAB"'
    : 'export NODE_ENV=production';
  if (text.includes(insertBefore)) {
    text = text.replace(insertBefore, `${BUNDLE_BLOCK}${insertBefore}`);
  } else if (text.includes('./gradlew bundleRelease')) {
    text = text.replace('./gradlew bundleRelease', `${BUNDLE_BLOCK}./gradlew bundleRelease`);
  } else {
    text = `${text.trimEnd()}\n\n${BUNDLE_BLOCK}`;
  }
  fs.writeFileSync(bundle, text);
  return { changed: true };
}

const appIds = [...new Set([...Object.keys(fleetProfiles), ...EXTRA_APPS])];
const report = [];

for (const appId of appIds) {
  const appDir = path.join(mobileRoot, appId);
  if (!fs.existsSync(appDir)) {
    report.push({ appId, status: 'missing' });
    continue;
  }
  const pkg = ensurePackageScripts(appDir);
  const pre = ensurePreflight(appDir);
  const bundle = ensureAndroidBundle(appDir);
  report.push({ appId, pkg, pre, bundle });
}

for (const row of report) {
  if (row.status === 'missing') {
    console.log(`${row.appId.padEnd(28)} MISSING`);
    continue;
  }
  console.log(
    `${row.appId.padEnd(28)} pkg=${row.pkg.changed ? 'wired' : 'ok'} preflight=${row.pre.skip ? 'n/a' : row.pre.changed ? 'wired' : 'ok'} bundle=${row.bundle.skip ? 'n/a' : row.bundle.changed ? 'wired' : 'ok'}`,
  );
}

console.log('\nFleet RN edge-to-edge wiring complete.');
