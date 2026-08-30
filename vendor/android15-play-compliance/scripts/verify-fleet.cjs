#!/usr/bin/env node
/**
 * Verify every Check app with an android/ tree meets Android 15 / Play baselines.
 */
const fs = require('fs');
const path = require('path');
const fleetProfiles = require('../src/fleetProfiles');
const { POLICY, resolveProps } = require('../src/policy');
const { hasDeprecatedEdgeToEdgeItems } = require('../src/stylesXml');
const { hasR8Enabled } = require('../src/gradleProps');
const { hasProguardOptimize } = require('../src/appBuildGradle');
const { hasPermissionRemove } = require('../src/manifestXml');

const mobileRoot = path.resolve(__dirname, '../../..');
const failures = [];

function fail(appId, msg) {
  failures.push(`${appId}: ${msg}`);
}

function read(appId, rel) {
  return fs.readFileSync(path.join(mobileRoot, appId, rel), 'utf8');
}

function exists(appId, rel) {
  return fs.existsSync(path.join(mobileRoot, appId, rel));
}

for (const [appId, meta] of Object.entries(fleetProfiles)) {
  const appDir = path.join(mobileRoot, appId);
  if (!fs.existsSync(appDir)) {
    fail(appId, 'app directory missing');
    continue;
  }

  // Config wiring
  const configPath = ['app.config.ts', 'app.config.js'].find((n) =>
    exists(appId, n),
  );
  if (configPath) {
    const cfg = read(appId, configPath);
    if (/import\s+\[withAndroid15PlayCompliance/.test(cfg)) {
      fail(appId, 'app.config has broken array import syntax');
    }
    if ((cfg.match(/from '@check\/android15-play-compliance'/g) || []).length !== 1) {
      fail(appId, 'app.config must import shared package exactly once');
    }
    if (!/plugins:\s*\[[\s\S]*withAndroid15PlayCompliance/.test(cfg)) {
      fail(appId, 'app.config missing withAndroid15PlayCompliance in plugins array');
    }
    // ExpoConfig.plugins typings omit ConfigPlugin functions — fleet requires the cast.
    if (!/withAndroid15PlayCompliance\s+as\s+unknown\s+as\s+string/.test(cfg)) {
      fail(appId, 'app.config must cast withAndroid15PlayCompliance as unknown as string');
    }
    if (
      meta.profile &&
      meta.profile !== 'standard' &&
      !cfg.includes(`profile: '${meta.profile}'`) &&
      !cfg.includes(`profile: "${meta.profile}"`)
    ) {
      fail(appId, `missing profile ${meta.profile} in plugins array`);
    }
  }

  const pkg = JSON.parse(read(appId, 'package.json'));
  const dep =
    pkg.dependencies?.['@check/android15-play-compliance'] ||
    pkg.devDependencies?.['@check/android15-play-compliance'];
  if (!dep) {
    fail(appId, 'package.json missing @check/android15-play-compliance');
  }

  // Prebuild / Expo config eval must resolve the plugin from the app tree.
  try {
    require.resolve('@check/android15-play-compliance', { paths: [appDir] });
  } catch {
    fail(appId, 'node_modules missing @check/android15-play-compliance (run npm install)');
  }

  // RN edge-to-edge patch must be wired for every release path (Play Console deprecated APIs).
  const patchCmd = 'node ../shared/android15-play-compliance/scripts/patch-rn-edge-to-edge.cjs';
  if (pkg.scripts?.['patch:rn-edge'] !== patchCmd) {
    fail(appId, 'package.json must define patch:rn-edge → shared patch-cli script');
  }
  if (pkg.scripts?.postinstall !== patchCmd) {
    fail(appId, 'package.json postinstall must run patch:rn-edge');
  }
  if (exists(appId, 'scripts/preflight.sh')) {
    const preflight = read(appId, 'scripts/preflight.sh');
    if (!/patch:rn-edge|patch-rn-edge-to-edge/.test(preflight)) {
      fail(appId, 'scripts/preflight.sh must run npm run patch:rn-edge');
    }
  }
  if (exists(appId, 'scripts/android-bundle.sh')) {
    const bundle = read(appId, 'scripts/android-bundle.sh');
    if (!/patch:rn-edge|patch-rn-edge-to-edge|patchReactNativeNodeModules/.test(bundle)) {
      fail(appId, 'scripts/android-bundle.sh must ensure RN edge-to-edge patch before Gradle');
    }
  }

  if (!exists(appId, 'android')) {
    continue; // prebuild-only — config/dep checks above are enough
  }

  const props = resolveProps({ profile: meta.profile });
  const styles = read(appId, 'android/app/src/main/res/values/styles.xml');
  // Match real <item> tags only — educational comments may mention the attr names.
  if (hasDeprecatedEdgeToEdgeItems(styles)) {
    fail(appId, 'styles.xml still sets deprecated edge-to-edge bar colors');
  }

  const gradle = read(appId, 'android/gradle.properties');
  if (!hasR8Enabled(gradle)) {
    fail(appId, 'R8 minify / resource shrinking / optimized shrinking not enabled');
  }

  if (exists(appId, 'android/app/build.gradle')) {
    const appGradle = read(appId, 'android/app/build.gradle');
    if (!hasProguardOptimize(appGradle)) {
      fail(appId, 'app/build.gradle must use proguard-android-optimize.txt');
    }
  }

  const manifest = read(appId, 'android/app/src/main/AndroidManifest.xml');
  if (props.removeSystemAlertWindow !== false) {
    const positiveSaw = manifest.match(
      /<uses-permission[^>]*SYSTEM_ALERT_WINDOW[^>]*\/>/g,
    );
    const badSaw = (positiveSaw || []).filter((line) => !/\btools:node\s*=\s*["']remove["']/.test(line));
    if (badSaw.length) {
      fail(appId, 'SYSTEM_ALERT_WINDOW still declared positively');
    }
    if (!hasPermissionRemove(manifest, 'android.permission.SYSTEM_ALERT_WINDOW')) {
      fail(appId, 'missing tools:node=remove for SYSTEM_ALERT_WINDOW');
    }
  }

  if (props.stripNotificationBoot) {
    if (manifest.includes('BOOT_COMPLETED') && manifest.includes('NotificationsService')) {
      // Override must not keep BOOT_COMPLETED inside NotificationsService block
      const idx = manifest.indexOf('NotificationsService');
      const slice = manifest.slice(idx, idx + 800);
      if (slice.includes('BOOT_COMPLETED')) {
        fail(appId, 'NotificationsService still registers BOOT_COMPLETED');
      }
    }
  }

  if (props.removeReceiveBootCompleted) {
    if (!hasPermissionRemove(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED')) {
      fail(appId, 'missing tools:node=remove for RECEIVE_BOOT_COMPLETED');
    }
  }

  if (meta.profile === 'keepBoot') {
    // SeaCheck / room display must not strip boot permission via remove
    if (hasPermissionRemove(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED')) {
      fail(appId, 'keepBoot profile must not remove RECEIVE_BOOT_COMPLETED');
    }
  }

  if (appId === 'seacheck') {
    const locService = path.join(
      mobileRoot,
      'seacheck/node_modules/expo-location/android/src/main/java/expo/modules/location/services/LocationTaskService.kt',
    );
    if (fs.existsSync(locService)) {
      const kt = fs.readFileSync(locService, 'utf8');
      if (!kt.includes('FOREGROUND_SERVICE_TYPE_LOCATION')) {
        fail(appId, 'LocationTaskService must use typed location FGS (API 34+)');
      }
    }
    if (!exists(appId, 'patches/expo-location+56.0.22.patch')) {
      fail(appId, 'missing patches/expo-location+56.0.22.patch');
    }
  }
}

// Policy sanity: location must remain allowed at boot
if (POLICY.isRestrictedBootFgsType('location')) {
  failures.push('policy: location must NOT be treated as BOOT_COMPLETED-restricted');
}
if (!POLICY.isRestrictedBootFgsType('dataSync') || !POLICY.isRestrictedBootFgsType('mediaPlayback')) {
  failures.push('policy: dataSync/mediaPlayback must be BOOT_COMPLETED-restricted');
}

if (failures.length) {
  console.error('Fleet Android 15 / Play compliance FAILED:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}

console.log(`Fleet Android 15 / Play compliance OK (${Object.keys(fleetProfiles).length} apps)`);
