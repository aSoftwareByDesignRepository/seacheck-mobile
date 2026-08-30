const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  POLICY,
  resolveProps,
  SAW,
  BOOT,
  NOTIFICATIONS_RECEIVER,
} = require('../src/policy');
const {
  ensurePermissionRemove,
  ensureNotificationsReceiverOverride,
  ensureToolsNamespace,
  hasPermissionRemove,
} = require('../src/manifestXml');
const {
  forceRemovePermission,
  stripBootActionsFromNotificationsReceiver,
  applyPlayComplianceToManifestObject,
} = require('../src/manifestObject');
const {
  hasDeprecatedEdgeToEdgeItems,
  stripDeprecatedEdgeToEdgeItems,
} = require('../src/stylesXml');
const {
  upsertGradleProp,
  enableR8GradleProperties,
  hasR8Enabled,
} = require('../src/gradleProps');
const {
  enableProguardOptimize,
  hasProguardOptimize,
} = require('../src/appBuildGradle');
const { loadExpoConfigPlugins } = require('../src/loadExpoConfigPlugins');
const { patchAndroidTree, patchStyles, patchGradleProperties, patchAppBuildGradle } = require('../src/patchAndroidTree');
const { findStylesXmlPaths, stripStylesFile } = require('../src/stylesFiles');
const {
  AGP_R8_POLICY,
  EXPO_SDK56_PINNED_AGP,
  assertAgpR8Policy,
  assertAgpR8UpgradeGate,
  assertR8GradleProperties,
  parseAgpVersionFromLibsToml,
  mustStayOnExpoPinnedAgp,
} = require('../src/agpR8Policy');
const fleetProfiles = require('../src/fleetProfiles');

describe('Android 15 Play compliance policy', () => {
  it('treats dataSync and mediaPlayback as boot-restricted, not location', () => {
    assert.equal(POLICY.isRestrictedBootFgsType('dataSync'), true);
    assert.equal(POLICY.isRestrictedBootFgsType('mediaPlayback'), true);
    assert.equal(POLICY.isRestrictedBootFgsType('camera'), true);
    assert.equal(POLICY.isRestrictedBootFgsType('location'), false);
    assert.equal(POLICY.isRestrictedBootFgsType('shortService'), false);
    assert.equal(POLICY.isRestrictedBootFgsType(null), false);
  });

  it('resolveProps applies stripNotificationBoot profile', () => {
    const props = resolveProps({ profile: 'stripNotificationBoot' });
    assert.equal(props.stripNotificationBoot, true);
    assert.equal(props.removeReceiveBootCompleted, true);
    assert.equal(props.removeSystemAlertWindow, true);
    assert.equal(props.enableR8, true);
    assert.equal(props.fixEdgeToEdgeStyles, true);
  });

  it('resolveProps keepBoot never strips boot', () => {
    const props = resolveProps({ profile: 'keepBoot' });
    assert.equal(props.stripNotificationBoot, false);
    assert.equal(props.removeReceiveBootCompleted, false);
    assert.equal(props.removeSystemAlertWindow, true);
  });

  it('resolveProps defaults to standard for unknown or missing profile', () => {
    assert.equal(resolveProps({}).stripNotificationBoot, false);
    assert.equal(resolveProps({ profile: 'nope' }).stripNotificationBoot, false);
    assert.equal(resolveProps({ profile: 'standard' }).enableR8, true);
  });

  it('explicit props override profile defaults including false', () => {
    const props = resolveProps({
      profile: 'keepBoot',
      enableR8: false,
      removeSystemAlertWindow: false,
    });
    assert.equal(props.enableR8, false);
    assert.equal(props.removeSystemAlertWindow, false);
    assert.equal(props.stripNotificationBoot, false);
  });

  it('fleet maps SeaCheck and Room Display to keepBoot', () => {
    assert.equal(fleetProfiles.seacheck.profile, 'keepBoot');
    assert.equal(fleetProfiles['deskcheck-roomdisplay'].profile, 'keepBoot');
    assert.equal(fleetProfiles.audiocheck.profile, 'stripNotificationBoot');
    assert.equal(fleetProfiles.budgetcheck.profile, 'standard');
    assert.equal(fleetProfiles.projectcheck.profile, 'standard');
  });

  it('every fleet profile name exists in POLICY.profiles', () => {
    for (const [appId, meta] of Object.entries(fleetProfiles)) {
      assert.ok(
        POLICY.profiles[meta.profile],
        `${appId} uses unknown profile ${meta.profile}`,
      );
    }
  });
});

describe('stylesXml', () => {
  it('detects real item tags and ignores educational comments', () => {
    const commentOnly = `
<style name="AppTheme">
  <!-- Edge-to-edge: do not set statusBarColor / navigationBarColor (deprecated on API 35+). -->
</style>`;
    assert.equal(hasDeprecatedEdgeToEdgeItems(commentOnly), false);

    const withItems = `
<style name="AppTheme">
  <item name="android:statusBarColor">@android:color/transparent</item>
  <item name="android:navigationBarColor">@android:color/transparent</item>
</style>`;
    assert.equal(hasDeprecatedEdgeToEdgeItems(withItems), true);
  });

  it('strips deprecated bar color and opt-out items without touching comments', () => {
    const input = `
<style name="AppTheme">
  <!-- keep statusBarColor mention -->
  <item name="android:statusBarColor">@android:color/transparent</item>
  <item name="android:navigationBarColor">#000</item>
  <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>
  <item name="android:windowBackground">@color/bg</item>
</style>`;
    const out = stripDeprecatedEdgeToEdgeItems(input);
    assert.equal(hasDeprecatedEdgeToEdgeItems(out), false);
    assert.match(out, /keep statusBarColor mention/);
    assert.match(out, /windowBackground/);
    assert.doesNotMatch(out, /windowOptOutEdgeToEdgeEnforcement/);
  });
});

describe('stylesFiles', () => {
  it('findStylesXmlPaths discovers values and values-* styles only', () => {
    const res = fs.mkdtempSync(path.join(os.tmpdir(), 'a15-res-'));
    try {
      fs.mkdirSync(path.join(res, 'values'));
      fs.mkdirSync(path.join(res, 'values-night'));
      fs.mkdirSync(path.join(res, 'values-v31'));
      fs.mkdirSync(path.join(res, 'drawable'));
      fs.writeFileSync(path.join(res, 'values', 'styles.xml'), '<resources/>');
      fs.writeFileSync(path.join(res, 'values-night', 'styles.xml'), '<resources/>');
      fs.writeFileSync(path.join(res, 'values-v31', 'colors.xml'), '<resources/>');
      fs.writeFileSync(path.join(res, 'drawable', 'styles.xml'), '<resources/>');
      const found = findStylesXmlPaths(res).sort();
      assert.deepEqual(
        found.map((p) => path.relative(res, p)).sort(),
        ['values-night/styles.xml', 'values/styles.xml'].sort(),
      );
    } finally {
      fs.rmSync(res, { recursive: true, force: true });
    }
  });

  it('stripStylesFile removes Expo SystemBars transparent colors', () => {
    const stylesPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'a15-styles-')),
      'styles.xml',
    );
    fs.writeFileSync(
      stylesPath,
      `<resources>
  <style name="AppTheme">
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
  </style>
</resources>
`,
    );
    assert.equal(stripStylesFile(stylesPath), true);
    const out = fs.readFileSync(stylesPath, 'utf8');
    assert.equal(hasDeprecatedEdgeToEdgeItems(out), false);
    assert.match(out, /colorPrimary/);
    assert.equal(stripStylesFile(stylesPath), false);
    fs.rmSync(path.dirname(stylesPath), { recursive: true, force: true });
  });
});

describe('expo plugin edge-to-edge wiring', () => {
  it('strips styles via withAndroidStyles + withFinalizedMod (not dangerous-only)', () => {
    // Expo SystemBars re-adds transparent bar colors after dangerous mods.
    // Regression: withDangerousMod alone left statusBarColor in styles.xml after prebuild.
    const src = fs.readFileSync(
      path.join(__dirname, '../src/withAndroid15PlayCompliance.js'),
      'utf8',
    );
    const start = src.indexOf('function withEdgeToEdgeStyles');
    const end = src.indexOf('function withR8GradleProperties');
    assert.ok(start >= 0 && end > start, 'withEdgeToEdgeStyles must exist before R8 helper');
    const edgeFn = src.slice(start, end);
    assert.match(edgeFn, /withAndroidStyles/);
    assert.match(edgeFn, /withFinalizedMod/);
    assert.match(edgeFn, /removeStylesItem/);
    assert.match(edgeFn, /findStylesXmlPaths|stripStylesFile/);
    assert.doesNotMatch(edgeFn, /withDangerousMod/);
  });
});

describe('gradleProps', () => {
  it('upserts missing and existing keys', () => {
    let text = 'android.useAndroidX=true\n';
    text = upsertGradleProp(text, 'android.enableMinifyInReleaseBuilds', 'true');
    assert.match(text, /^android\.enableMinifyInReleaseBuilds=true$/m);
    text = upsertGradleProp(text, 'android.enableMinifyInReleaseBuilds', 'false');
    assert.match(text, /^android\.enableMinifyInReleaseBuilds=false$/m);
    assert.equal((text.match(/enableMinifyInReleaseBuilds/g) || []).length, 1);
  });

  it('enableR8GradleProperties sets minify, shrink, and optimized shrinking', () => {
    const out = enableR8GradleProperties('foo=1\n');
    assert.equal(hasR8Enabled(out), true);
    assert.match(out, /^android\.r8\.optimizedResourceShrinking=true$/m);
  });

  it('hasR8Enabled requires optimized resource shrinking', () => {
    const partial =
      'android.enableMinifyInReleaseBuilds=true\nandroid.enableShrinkResourcesInReleaseBuilds=true\n';
    assert.equal(hasR8Enabled(partial), false);
  });
});

describe('appBuildGradle', () => {
  it('switches proguard-android.txt to optimize variant', () => {
    const input =
      'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"\n';
    const out = enableProguardOptimize(input);
    assert.equal(hasProguardOptimize(out), true);
    assert.doesNotMatch(out, /proguard-android\.txt/);
  });

  it('detects absence of the optimize proguard file', () => {
    assert.equal(
      hasProguardOptimize('getDefaultProguardFile("proguard-android.txt")'),
      false,
    );
  });

  it('is idempotent when already optimized', () => {
    const input =
      'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"\n';
    assert.equal(enableProguardOptimize(input), input);
  });

  it('no-ops when proguardFiles line is absent', () => {
    const input = 'android { }\n';
    assert.equal(enableProguardOptimize(input), input);
    assert.equal(hasProguardOptimize(input), false);
  });
});

describe('manifestXml', () => {
  it('adds tools namespace once', () => {
    const input = `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
`;
    const once = ensureToolsNamespace(input);
    const twice = ensureToolsNamespace(once);
    assert.equal((once.match(/xmlns:tools=/g) || []).length, 1);
    assert.equal(twice, once);
  });

  it('removes positive SAW and adds tools:node=remove', () => {
    const input = `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>
`;
    const out = ensurePermissionRemove(input, SAW);
    assert.equal(hasPermissionRemove(out, SAW), true);
    assert.doesNotMatch(
      out,
      /<uses-permission android:name="android\.permission\.SYSTEM_ALERT_WINDOW"\s*\/>/,
    );
  });

  it('detects remove directive regardless of attribute order', () => {
    const reversed = `<manifest xmlns:tools="http://schemas.android.com/tools">
  <uses-permission tools:node="remove" android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
</manifest>`;
    assert.equal(hasPermissionRemove(reversed, SAW), true);
    const again = ensurePermissionRemove(reversed, SAW);
    assert.equal((again.match(/SYSTEM_ALERT_WINDOW/g) || []).length, 1);
  });

  it('permission remove is idempotent', () => {
    let xml = `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>
`;
    xml = ensurePermissionRemove(xml, SAW);
    const once = xml;
    xml = ensurePermissionRemove(xml, SAW);
    assert.equal((xml.match(/SYSTEM_ALERT_WINDOW/g) || []).length, 1);
    assert.equal(hasPermissionRemove(once, SAW), true);
  });

  it('strips positive permission that has maxSdkVersion', () => {
    const input = `<manifest>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" android:maxSdkVersion="28"/>
</manifest>`;
    const out = ensurePermissionRemove(input, SAW);
    assert.doesNotMatch(out, /maxSdkVersion/);
    assert.equal(hasPermissionRemove(out, SAW), true);
  });

  it('injects notifications receiver override without BOOT_COMPLETED', () => {
    const input = `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <application>
  </application>
</manifest>
`;
    const out = ensureNotificationsReceiverOverride(input);
    assert.match(out, /NotificationsService/);
    assert.match(out, /NOTIFICATION_EVENT/);
    assert.match(out, /MY_PACKAGE_REPLACED/);
    assert.doesNotMatch(out, /BOOT_COMPLETED/);
  });

  it('leaves a correct notifications override unchanged', () => {
    const good = `<?xml version="1.0"?>
<manifest xmlns:tools="http://schemas.android.com/tools">
  <application>
    <receiver android:name="expo.modules.notifications.service.NotificationsService" tools:node="merge">
      <intent-filter android:priority="-1" tools:node="replace">
        <action android:name="expo.modules.notifications.NOTIFICATION_EVENT"/>
        <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
      </intent-filter>
    </receiver>
  </application>
</manifest>`;
    assert.equal(ensureNotificationsReceiverOverride(good), good);
  });
});

describe('manifestObject', () => {
  function getMainApplication(manifest) {
    const app = manifest.manifest.application?.[0] ?? manifest.manifest.application;
    if (!app) throw new Error('no application');
    return app;
  }

  it('forceRemovePermission replaces positive entries with remove', () => {
    const manifest = {
      manifest: {
        $: {},
        'uses-permission': [{ $: { 'android:name': SAW } }],
      },
    };
    forceRemovePermission(manifest, SAW);
    assert.equal(manifest.manifest['uses-permission'].length, 1);
    assert.equal(manifest.manifest['uses-permission'][0].$['tools:node'], 'remove');
  });

  it('stripBootActions creates receiver without BOOT_COMPLETED', () => {
    const manifest = {
      manifest: {
        application: [{ receiver: [] }],
      },
    };
    stripBootActionsFromNotificationsReceiver(manifest, getMainApplication);
    const receiver = manifest.manifest.application[0].receiver[0];
    assert.equal(receiver.$['android:name'], NOTIFICATIONS_RECEIVER);
    const actions = receiver['intent-filter'][0].action.map((a) => a.$['android:name']);
    assert.ok(actions.includes('expo.modules.notifications.NOTIFICATION_EVENT'));
    assert.ok(actions.includes('android.intent.action.MY_PACKAGE_REPLACED'));
    assert.ok(!actions.some((a) => a.includes('BOOT_COMPLETED')));
  });

  it('applyPlayComplianceToManifestObject respects strip + boot remove', () => {
    const manifest = {
      manifest: {
        $: {},
        'uses-permission': [
          { $: { 'android:name': SAW } },
          { $: { 'android:name': BOOT } },
        ],
        application: [{}],
      },
    };
    applyPlayComplianceToManifestObject(
      manifest,
      resolveProps({ profile: 'stripNotificationBoot' }),
      getMainApplication,
    );
    assert.equal(manifest.manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
    const names = manifest.manifest['uses-permission'].map((p) => p.$['android:name']);
    assert.ok(names.includes(SAW));
    assert.ok(names.includes(BOOT));
    assert.ok(manifest.manifest['uses-permission'].every((p) => p.$['tools:node'] === 'remove'));
  });

  it('applyPlayComplianceToManifestObject keepBoot leaves BOOT permission alone', () => {
    const manifest = {
      manifest: {
        $: {},
        'uses-permission': [{ $: { 'android:name': BOOT } }],
        application: [{}],
      },
    };
    applyPlayComplianceToManifestObject(
      manifest,
      resolveProps({ profile: 'keepBoot' }),
      getMainApplication,
    );
    const boot = manifest.manifest['uses-permission'].find((p) => p.$['android:name'] === BOOT);
    assert.ok(boot);
    assert.notEqual(boot.$['tools:node'], 'remove');
  });
});

describe('loadExpoConfigPlugins', () => {
  it('resolves via createRequire from cwd package.json first', () => {
    const calls = [];
    const fakePlugins = { AndroidConfig: {}, withAndroidManifest: () => {}, withDangerousMod: () => {} };
    const result = loadExpoConfigPlugins({
      cwd: '/app',
      selfFilename: '/shared/load.js',
      createRequireImpl: (filename) => {
        calls.push(filename);
        return (id) => {
          if (filename === path.join('/app', 'package.json') && id === 'expo/config-plugins') {
            return fakePlugins;
          }
          throw new Error(`fail ${filename} ${id}`);
        };
      },
      requireImpl: () => {
        throw new Error('should not fall through');
      },
    });
    assert.equal(result, fakePlugins);
    assert.equal(calls[0], path.join('/app', 'package.json'));
  });

  it('falls back to selfFilename then requireImpl', () => {
    const fakePlugins = { ok: true };
    const result = loadExpoConfigPlugins({
      cwd: '/missing',
      selfFilename: '/app/node_modules/@check/android15-play-compliance/src/load.js',
      createRequireImpl: (filename) => (id) => {
        if (
          filename.includes('android15-play-compliance') &&
          id === 'expo/config-plugins'
        ) {
          return fakePlugins;
        }
        throw new Error('nope');
      },
      requireImpl: () => {
        throw new Error('nope');
      },
    });
    assert.equal(result, fakePlugins);
  });

  it('annotates error with tried paths when all strategies fail', () => {
    assert.throws(
      () =>
        loadExpoConfigPlugins({
          cwd: '/x',
          selfFilename: '/y.js',
          createRequireImpl: () => () => {
            throw new Error('missing');
          },
          requireImpl: () => {
            throw Object.assign(new Error('Cannot find module'), { code: 'MODULE_NOT_FOUND' });
          },
        }),
      /also tried createRequire from:/,
    );
  });
});

describe('patchAndroidTree integration', () => {
  let tmp;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a15-'));
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('skips when android/ is absent', () => {
    const appRoot = path.join(tmp, 'no-android-app');
    fs.mkdirSync(appRoot);
    const result = patchAndroidTree(appRoot, { profile: 'standard' });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'no-android');
  });

  it('patches styles, gradle, manifest, and proguard for strip profile', () => {
    const appRoot = path.join(tmp, 'full-app');
    const android = path.join(appRoot, 'android');
    const values = path.join(android, 'app/src/main/res/values');
    fs.mkdirSync(values, { recursive: true });
    fs.mkdirSync(path.join(android, 'app'), { recursive: true });

    fs.writeFileSync(
      path.join(android, 'app/src/main/AndroidManifest.xml'),
      `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <application></application>
</manifest>
`,
    );
    fs.writeFileSync(
      path.join(values, 'styles.xml'),
      `<resources>
  <style name="AppTheme">
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
  </style>
</resources>
`,
    );
    fs.writeFileSync(path.join(android, 'gradle.properties'), 'android.useAndroidX=true\n');
    fs.writeFileSync(
      path.join(android, 'app/build.gradle'),
      `android {
  buildTypes {
    release {
      proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
  }
}
`,
    );

    const result = patchAndroidTree(appRoot, { profile: 'stripNotificationBoot' });
    assert.equal(result.skipped, false);
    assert.ok(result.changes.includes('AndroidManifest.xml'));
    assert.ok(result.changes.includes('styles.xml'));
    assert.ok(result.changes.includes('gradle.properties'));
    assert.ok(result.changes.includes('app/build.gradle'));
    assert.ok(result.changes.includes('proguard-rules.pro'));

    const styles = fs.readFileSync(path.join(values, 'styles.xml'), 'utf8');
    assert.equal(hasDeprecatedEdgeToEdgeItems(styles), false);

    const gradle = fs.readFileSync(path.join(android, 'gradle.properties'), 'utf8');
    assert.equal(hasR8Enabled(gradle), true);

    const appGradle = fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8');
    assert.equal(hasProguardOptimize(appGradle), true);

    const manifest = fs.readFileSync(
      path.join(android, 'app/src/main/AndroidManifest.xml'),
      'utf8',
    );
    assert.equal(hasPermissionRemove(manifest, SAW), true);
    assert.equal(hasPermissionRemove(manifest, BOOT), true);
    assert.match(manifest, /NotificationsService/);
    assert.doesNotMatch(manifest, /NotificationsService[\s\S]*BOOT_COMPLETED/);

    // Idempotent second pass
    const again = patchAndroidTree(appRoot, { profile: 'stripNotificationBoot' });
    assert.deepEqual(again.changes, []);
  });

  it('patchStyles no-ops on comment-only educational styles', () => {
    const stylesPath = path.join(tmp, 'comment-styles.xml');
    const body = `<resources>
  <style name="AppTheme">
    <!-- Edge-to-edge: do not set statusBarColor / navigationBarColor -->
  </style>
</resources>
`;
    fs.writeFileSync(stylesPath, body);
    assert.equal(patchStyles(stylesPath), false);
    assert.equal(fs.readFileSync(stylesPath, 'utf8'), body);
  });

  it('patchGradleProperties is idempotent once R8 is on', () => {
    const propsPath = path.join(tmp, 'gradle.properties');
    fs.writeFileSync(propsPath, enableR8GradleProperties('x=1\n'));
    assert.equal(patchGradleProperties(propsPath), false);
  });

  it('patchAppBuildGradle is idempotent once optimize file is set', () => {
    const gradlePath = path.join(tmp, 'app-build.gradle');
    fs.writeFileSync(
      gradlePath,
      'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"\n',
    );
    assert.equal(patchAppBuildGradle(gradlePath), false);
  });

  it('skips proguard write when android/app directory is missing', () => {
    const appRoot = path.join(tmp, 'props-only-app');
    const android = path.join(appRoot, 'android');
    fs.mkdirSync(android, { recursive: true });
    fs.writeFileSync(path.join(android, 'gradle.properties'), 'android.useAndroidX=true\n');
    const result = patchAndroidTree(appRoot, { profile: 'standard' });
    assert.equal(result.skipped, false);
    assert.ok(result.changes.includes('gradle.properties'));
    assert.equal(result.changes.includes('proguard-rules.pro'), false);
    assert.equal(fs.existsSync(path.join(android, 'app')), false);
  });
});

const {
  patchWindowUtilKt,
  patchStatusBarModuleKt,
  isReactNativeEdgeToEdgeClean,
  MARKER,
} = require('../src/reactNativeEdgeToEdgePatch');
const {
  patchReactNativeNodeModules,
  verifyReactNativeNodeModules,
} = require('../src/patchReactNativeNodeModules');

describe('agpR8Policy (Play R8 / AGP 9 advisory)', () => {
  it('locks the safe Expo SDK 56 contract (no forced AGP 9)', () => {
    assert.equal(AGP_R8_POLICY.forceAgp9OutsideExpoPin, false);
    assert.equal(AGP_R8_POLICY.optimizedResourceShrinking, true);
    assert.deepEqual(assertAgpR8Policy(), []);
    assert.equal(EXPO_SDK56_PINNED_AGP, '8.12.0');
  });

  it('requires the full R8 gradle.properties stack', () => {
    assert.deepEqual(
      assertR8GradleProperties(
        'android.enableMinifyInReleaseBuilds=true\nandroid.enableShrinkResourcesInReleaseBuilds=true\nandroid.r8.optimizedResourceShrinking=true\n',
      ),
      [],
    );
    assert.ok(
      assertR8GradleProperties('android.enableMinifyInReleaseBuilds=true\n').includes(
        'android.r8.optimizedResourceShrinking',
      ),
    );
  });

  it('fails when AGP 9 is forced while Expo still pins 8.x', () => {
    const failures = assertAgpR8UpgradeGate({
      policy: { ...AGP_R8_POLICY, forceAgp9OutsideExpoPin: true },
      libsToml: 'agp = "8.12.0"\n',
      gradleProperties:
        'android.enableMinifyInReleaseBuilds=true\nandroid.enableShrinkResourcesInReleaseBuilds=true\nandroid.r8.optimizedResourceShrinking=true\n',
      appBuildGradle:
        'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
    });
    assert.ok(failures.includes('forceAgp9OutsideExpoPin'));
    assert.ok(failures.includes('forced-agp9-while-expo-pins-8'));
  });

  it('classifies the RN catalog AGP pin', () => {
    assert.equal(parseAgpVersionFromLibsToml('agp = "8.12.0"\n'), '8.12.0');
    assert.equal(mustStayOnExpoPinnedAgp('8.12.0'), true);
    assert.equal(mustStayOnExpoPinnedAgp('9.0.0'), false);
  });
});

describe('reactNativeEdgeToEdgePatch', () => {
  const sampleWindow = `package com.facebook.react.views.view

import android.graphics.Color
import android.os.Build
import android.view.Window
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.views.common.UiModeUtils

internal val LightNavigationBarColor = Color.argb(0xe6, 0xFF, 0xFF, 0xFF)
internal val DarkNavigationBarColor = Color.argb(0x80, 0x1b, 0x1b, 0x1b)

@Suppress("DEPRECATION")
private fun Window.statusBarHide() {
  if (isEdgeToEdgeFeatureFlagOn) {
    WindowInsetsControllerCompat(this, decorView).run {
      hide(WindowInsetsCompat.Type.statusBars())
    }
  } else {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
  }
}

@Suppress("DEPRECATION")
private fun Window.statusBarShow() {
  if (isEdgeToEdgeFeatureFlagOn) {
    WindowInsetsControllerCompat(this, decorView).run {
      show(WindowInsetsCompat.Type.statusBars())
    }
  } else {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
    }
  }
}

@Suppress("DEPRECATION")
internal fun Window.enableEdgeToEdge() {
  WindowCompat.setDecorFitsSystemWindows(this, false)
  statusBarColor = Color.TRANSPARENT
  navigationBarColor = Color.TRANSPARENT
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    attributes.layoutInDisplayCutoutMode =
        when {
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
              WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
          else -> WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
  }
}
`;

  const sampleStatus = `package com.facebook.react.modules.statusbar

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.view.WindowManager
import com.facebook.react.bridge.GuardedRunnable

@Suppress("DEPRECATION")
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    val statusBarColor =
        currentActivity?.window?.statusBarColor?.let { color ->
          String.format("#%06X", 0xFFFFFF and color)
        } ?: "black"
    return mapOf(
        HEIGHT_KEY to 24.0,
        DEFAULT_BACKGROUND_COLOR_KEY to statusBarColor,
    )
  }

@Suppress("DEPRECATION")
  override fun setColor(colorDouble: Double, animated: Boolean) {
    val color = colorDouble.toInt()
    UiThreadUtil.runOnUiThread(
        object : GuardedRunnable(reactApplicationContext) {
          override fun runGuarded() {
            val window = activity.window ?: return
            window.statusBarColor = color
          }
        }
    )
  }
`;

  it('strips deprecated Window color and cutout APIs from WindowUtil.kt', () => {
    const once = patchWindowUtilKt(sampleWindow);
    assert.equal(once.changed, true);
    assert.match(once.text, new RegExp(MARKER));
    assert.equal(isReactNativeEdgeToEdgeClean({ windowUtil: once.text, statusBarModule: '' }), false);
    assert.doesNotMatch(once.text, /\.statusBarColor\b/);
    assert.doesNotMatch(once.text, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES/);
    assert.doesNotMatch(once.text, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT/);
    const twice = patchWindowUtilKt(once.text);
    assert.equal(twice.changed, false);
  });

  it('strips statusBarColor reads/writes from StatusBarModule.kt', () => {
    const once = patchStatusBarModuleKt(sampleStatus);
    assert.equal(once.changed, true);
    assert.match(once.text, /transparent/);
    assert.doesNotMatch(once.text, /\.statusBarColor\b|val statusBarColor\b/);
    assert.doesNotMatch(once.text, /ArgbEvaluator/);
    const twice = patchStatusBarModuleKt(once.text);
    assert.equal(twice.changed, false);
    assert.equal(
      isReactNativeEdgeToEdgeClean({
        windowUtil: patchWindowUtilKt(sampleWindow).text,
        statusBarModule: once.text,
      }),
      true,
    );
  });

  it('patchReactNativeNodeModules is idempotent on real projectcheck RN', () => {
    const app = path.resolve(__dirname, '../../projectcheck');
    if (!fs.existsSync(path.join(app, 'node_modules/react-native'))) {
      return;
    }
    const first = patchReactNativeNodeModules(app);
    assert.equal(first.skipped, false);
    assert.equal(first.clean, true);
    const second = patchReactNativeNodeModules(app);
    assert.equal(second.changes.length, 0);
    assert.equal(verifyReactNativeNodeModules(app).clean, true);
  });
});
