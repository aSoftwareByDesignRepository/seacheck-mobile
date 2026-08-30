#!/usr/bin/env node
/**
 * Apply Android 15 Play compliance patches to every Check app android/ tree
 * and ensure app.config.ts registers the shared plugin (safe, idempotent).
 */
const fs = require('fs');
const path = require('path');
const { patchAndroidTree } = require('../src/patchAndroidTree');
const { resolveProps } = require('../src/policy');
const fleetProfiles = require('../src/fleetProfiles');

const mobileRoot = path.resolve(__dirname, '../../..');

function ensurePluginInAppConfig(appDir, profileName) {
  const configPath = path.join(appDir, 'app.config.ts');
  if (!fs.existsSync(configPath)) {
    return { ok: false, reason: 'no-app-config' };
  }

  let text = fs.readFileSync(configPath, 'utf8');
  let changed = false;

  // Drop obsolete local plugin path.
  if (text.includes("./plugins/withAndroid15PlayCompliance")) {
    text = text.replace(
      /^import\s+withAndroid15PlayCompliance\s+from\s+['"]\.\/plugins\/withAndroid15PlayCompliance['"];\s*\n/m,
      '',
    );
    text = text.replace(/^\s*['"]\.\/plugins\/withAndroid15PlayCompliance['"],?\s*\n/m, '');
    changed = true;
  }

  if (!text.includes("from '@check/android15-play-compliance'")) {
    const lines = text.split('\n');
    let lastImport = -1;
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    const importLine = "import withAndroid15PlayCompliance from '@check/android15-play-compliance';";
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
    else lines.unshift(importLine);
    text = lines.join('\n');
    changed = true;
  }

  // ExpoConfig.plugins typings omit ConfigPlugin functions — cast required for tsc.
  const pluginExpr =
    profileName && profileName !== 'standard'
      ? `[withAndroid15PlayCompliance as unknown as string, { profile: '${profileName}' }]`
      : 'withAndroid15PlayCompliance as unknown as string';

  if (!/plugins:\s*\[[\s\S]*withAndroid15PlayCompliance/.test(text)) {
    if (/withAndroidReleaseSigning/.test(text)) {
      text = text.replace(
        /(\n)([ \t]*)(withAndroidReleaseSigning)/,
        `$1$2${pluginExpr},\n$2$3`,
      );
    } else if (/plugins:\s*\[/.test(text)) {
      text = text.replace(/plugins:\s*\[/, `plugins: [\n    ${pluginExpr},`);
    } else {
      return { ok: false, reason: 'no-plugins-array' };
    }
    changed = true;
  }

  if (changed) fs.writeFileSync(configPath, text);
  return { ok: true, changed };
}

function ensurePackageDependency(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const depName = '@check/android15-play-compliance';
  const rel = 'file:../shared/android15-play-compliance';
  if (pkg.dependencies?.[depName] === rel || pkg.devDependencies?.[depName] === rel) {
    return false;
  }
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies[depName] = rel;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

const report = [];
for (const [appId, meta] of Object.entries(fleetProfiles)) {
  const appDir = path.join(mobileRoot, appId);
  if (!fs.existsSync(appDir)) {
    report.push({ appId, status: 'missing' });
    continue;
  }
  const props = resolveProps({ profile: meta.profile });
  const tree = patchAndroidTree(appDir, props);
  const depChanged = ensurePackageDependency(appDir);
  const cfg = ensurePluginInAppConfig(appDir, meta.profile);
  report.push({ appId, profile: meta.profile, tree, depChanged, config: cfg });
}

for (const row of report) {
  const treeInfo = row.tree?.skipped
    ? `android: skipped (${row.tree.reason})`
    : `android: ${(row.tree?.changes || []).join(', ') || 'unchanged'}`;
  console.log(
    `${row.appId.padEnd(28)} profile=${String(row.profile || '-').padEnd(22)} ${treeInfo} | dep=${row.depChanged ? 'added' : 'ok'} | config=${row.config?.changed ? 'wired' : row.config?.ok ? 'ok' : row.config?.reason}`,
  );
}

const failed = report.filter((r) => r.config && r.config.ok === false);
if (failed.length) {
  console.error('\nFailed to wire some app.config files:');
  for (const f of failed) console.error(` - ${f.appId}: ${f.config.reason}`);
  process.exit(1);
}

console.log('\nFleet android tree + config wiring complete.');
