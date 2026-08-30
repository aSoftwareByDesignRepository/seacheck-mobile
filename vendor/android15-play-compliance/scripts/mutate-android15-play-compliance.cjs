/**
 * Mutation gate for shared Android 15 Play compliance policy + helpers.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const targets = [
  {
    rel: 'src/policy.js',
    mutants: [
      {
        name: 'location-restricted',
        apply: (s) =>
          s.replace(
            "restrictedBootFgsTypes: Object.freeze([\n    'dataSync',",
            "restrictedBootFgsTypes: Object.freeze([\n    'location',\n    'dataSync',",
          ),
      },
      {
        name: 'dataSync-allowed',
        apply: (s) => s.replace("'dataSync',\n    'camera',", "'camera',"),
      },
      {
        name: 'keepBoot-strips',
        apply: (s) =>
          s.replace(
            "keepBoot: Object.freeze({\n      removeSystemAlertWindow: true,\n      fixEdgeToEdgeStyles: true,\n      enableR8: true,\n      stripNotificationBoot: false,\n      removeReceiveBootCompleted: false,\n    }),",
            "keepBoot: Object.freeze({\n      removeSystemAlertWindow: true,\n      fixEdgeToEdgeStyles: true,\n      enableR8: true,\n      stripNotificationBoot: true,\n      removeReceiveBootCompleted: true,\n    }),",
          ),
      },
      {
        name: 'strip-profile-keeps-boot',
        apply: (s) =>
          s.replace(
            "stripNotificationBoot: Object.freeze({\n      removeSystemAlertWindow: true,\n      fixEdgeToEdgeStyles: true,\n      enableR8: true,\n      stripNotificationBoot: true,\n      removeReceiveBootCompleted: true,\n    }),",
            "stripNotificationBoot: Object.freeze({\n      removeSystemAlertWindow: true,\n      fixEdgeToEdgeStyles: true,\n      enableR8: true,\n      stripNotificationBoot: false,\n      removeReceiveBootCompleted: false,\n    }),",
          ),
      },
      {
        name: 'unknown-profile-uses-strip',
        apply: (s) =>
          s.replace(
            'const base = profileName ? { ...POLICY.profiles[profileName] } : { ...POLICY.profiles.standard };',
            'const base = profileName ? { ...POLICY.profiles[profileName] } : { ...POLICY.profiles.stripNotificationBoot };',
          ),
      },
    ],
  },
  {
    rel: 'src/stylesXml.js',
    mutants: [
      {
        name: 'never-detect-bar-items',
        apply: (s) =>
          s.replace(
            'return /<item\\s+name="android:(?:statusBarColor|navigationBarColor)"\\s*>/.test(String(xml));',
            'return false;',
          ),
      },
      {
        name: 'strip-noop',
        apply: (s) =>
          s.replace(
            'return String(xml).replace(DEPRECATED_BAR_ITEM, \'\');',
            'return String(xml);',
          ),
      },
    ],
  },
  {
    rel: 'src/withAndroid15PlayCompliance.js',
    mutants: [
      {
        name: 'edge-styles-use-dangerous-instead-of-finalized',
        apply: (s) =>
          s.replace(
            'return withFinalizedMod(config, [',
            'return withDangerousMod(config, [',
          ),
      },
      {
        name: 'edge-styles-drop-android-styles-remove',
        apply: (s) =>
          s.replace(
            'config = withAndroidStyles(config, (cfg) => {\n    const parent = AndroidConfig.Styles.getAppThemeGroup();\n    for (const name of DEPRECATED_STYLE_ATTRS) {\n      cfg.modResults = AndroidConfig.Styles.removeStylesItem({\n        name,\n        xml: cfg.modResults,\n        parent,\n      });\n    }\n    return cfg;\n  });\n\n  return withFinalizedMod',
            'return withFinalizedMod',
          ),
      },
    ],
  },
  {
    rel: 'src/stylesFiles.js',
    mutants: [
      {
        name: 'find-styles-skips-values-night',
        apply: (s) =>
          s.replace(
            'if (!ent.isDirectory() || !/^values(-|$)/.test(ent.name)) continue;',
            "if (!ent.isDirectory() || ent.name !== 'values') continue;",
          ),
      },
      {
        name: 'strip-styles-file-never-writes',
        apply: (s) =>
          s.replace(
            'if (xml !== before) {\n    fs.writeFileSync(stylesPath, xml);\n    return true;\n  }',
            'if (xml !== before) {\n    return false;\n  }',
          ),
      },
    ],
  },
  {
    rel: 'src/manifestXml.js',
    mutants: [
      {
        name: 'hasPermissionRemove-always-false',
        apply: (s) =>
          s.replace(
            'return re.test(String(xml));',
            'return false;',
          ),
      },
      {
        name: 'ensurePermissionRemove-skips-insert',
        apply: (s) =>
          s.replace(
            'if (!hasPermissionRemove(source, permission)) {\n    const removeLine',
            'if (false) {\n    const removeLine',
          ),
      },
    ],
  },
  {
    rel: 'src/gradleProps.js',
    mutants: [
      {
        name: 'skip-optimized-shrinking',
        apply: (s) =>
          s.replace(
            "next = upsertGradleProp(next, 'android.r8.optimizedResourceShrinking', 'true');\n  return next;",
            'return next;',
          ),
      },
      {
        name: 'hasR8-ignores-optimized',
        apply: (s) =>
          s.replace(
            "    /android\\.enableShrinkResourcesInReleaseBuilds\\s*=\\s*true/.test(source) &&\n    /android\\.r8\\.optimizedResourceShrinking\\s*=\\s*true/.test(source)",
            '    /android\\.enableShrinkResourcesInReleaseBuilds\\s*=\\s*true/.test(source)',
          ),
      },
    ],
  },
  {
    rel: 'src/appBuildGradle.js',
    mutants: [
      {
        name: 'optimize-writes-legacy',
        apply: (s) =>
          s.replace(
            'getDefaultProguardFile("proguard-android-optimize.txt")',
            'getDefaultProguardFile("proguard-android.txt")',
          ),
      },
      {
        name: 'hasProguardOptimize-always-true',
        apply: (s) =>
          s.replace(
            'function hasProguardOptimize(text) {\n  return /getDefaultProguardFile',
            'function hasProguardOptimize(text) {\n  return true || /getDefaultProguardFile',
          ),
      },
    ],
  },
  {
    rel: 'src/loadExpoConfigPlugins.js',
    mutants: [
      {
        name: 'skip-cwd-resolution',
        apply: (s) =>
          s.replace(
            'const fromCwd = tryFrom(path.join(cwd, \'package.json\'));\n  if (fromCwd) return fromCwd;',
            'const fromCwd = null;\n  if (fromCwd) return fromCwd;',
          ),
      },
    ],
  },
  {
    rel: 'src/reactNativeEdgeToEdgePatch.js',
    mutants: [
      {
        name: 'leave-statusbar-property',
        apply: (s) =>
          s.replace(
            'DEFAULT_BACKGROUND_COLOR_KEY to "transparent",',
            'DEFAULT_BACKGROUND_COLOR_KEY to currentActivity?.window?.statusBarColor?.toString() ?: "transparent",',
          ),
      },
      {
        name: 'keep-short-edges',
        apply: (s) =>
          s.replace(
            'WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS',
            'WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES',
          ),
      },
    ],
  },
  {
    rel: 'src/agpR8Policy.js',
    mutants: [
      {
        name: 'force-agp9-outside-pin',
        apply: (s) => s.replace('forceAgp9OutsideExpoPin: false', 'forceAgp9OutsideExpoPin: true'),
      },
      {
        name: 'drop-optimized-shrinking',
        apply: (s) => s.replace('optimizedResourceShrinking: true', 'optimizedResourceShrinking: false'),
      },
      {
        name: 'allow-non-optimize-proguard',
        apply: (s) => s.replace('useProguardAndroidOptimize: true', 'useProguardAndroidOptimize: false'),
      },
    ],
  },
];

function runTests() {
  return spawnSync('node', ['--test', '__tests__/policy.test.js'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function fail(msg) {
  for (const t of targets) {
    const p = path.join(root, t.rel);
    if (t._original) fs.writeFileSync(p, t._original);
  }
  console.error(msg);
  process.exit(1);
}

for (const t of targets) {
  t._original = fs.readFileSync(path.join(root, t.rel), 'utf8');
}

const baseline = runTests();
if (baseline.status !== 0) {
  fail(`baseline failed:\n${baseline.stdout}\n${baseline.stderr}`);
}
console.log('baseline OK');

for (const t of targets) {
  for (const mutant of t.mutants) {
    const mutated = mutant.apply(t._original);
    if (mutated === t._original) fail(`mutant ${t.rel}:${mutant.name} did not change source`);
    fs.writeFileSync(path.join(root, t.rel), mutated);
    const result = runTests();
    fs.writeFileSync(path.join(root, t.rel), t._original);
    if (result.status === 0) fail(`mutant ${t.rel}:${mutant.name} was NOT killed`);
    console.log(`killed ${t.rel}:${mutant.name}`);
  }
}

for (const t of targets) {
  fs.writeFileSync(path.join(root, t.rel), t._original);
}
console.log('android15-play-compliance mutation gate OK');
