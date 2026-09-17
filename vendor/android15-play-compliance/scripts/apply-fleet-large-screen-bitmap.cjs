#!/usr/bin/env node
/**
 * Unlock large-screen orientation + wire expo-image / OptimizedImage across the fleet.
 * Idempotent. Complements apply-fleet (R8/edge) and apply-fleet-rn-edge.
 */
const fs = require('fs');
const path = require('path');
const fleetProfiles = require('../src/fleetProfiles');

const mobileRoot = path.resolve(__dirname, '../../..');
const EXPO_IMAGE = '~56.0.12';

/** Apps that must be in the fleet but may use a vendor copy of this package. */
const EXTRA_APPS = ['flowcheck', 'snackcheck-kiosk'];

const VERSION_BUMPS = {
  customercheck: { version: '1.0.16', versionCode: 16 },
  deskcheck: { version: '1.0.5', versionCode: 6 },
  inventorycheck: { version: '1.0.4', versionCode: 5 },
  invoicecheck: { version: '1.0.5', versionCode: 6 },
  maintenancecheck: { version: '1.2.5', versionCode: 8 },
  mobilitycheck: { version: '1.0.5', versionCode: 6 },
  ticketcheck: { version: '0.1.5', versionCode: 6 },
  flowcheck: { version: '1.0.1', versionCode: 2 },
  'mobilitycheck-terminal': { version: '1.0.5', versionCode: 6 },
};

const OPTIMIZED_IMAGE_SRC = `import { Image, type ImageProps } from 'expo-image';

/**
 * Memory-safe image host for Play Console bitmap optimization.
 *
 * Play flags raw React Native \`Image\` / Fresco decode paths when bitmaps
 * are shown without an image-loading library. \`expo-image\` downsamples,
 * caches, and recycles bitmaps (Glide on Android).
 */
export function OptimizedImage({
  cachePolicy = 'memory-disk',
  contentFit = 'contain',
  transition = 0,
  ...rest
}: ImageProps) {
  return (
    <Image
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
      {...rest}
    />
  );
}
`;

const EXPO_IMAGE_MOCK = `
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ExpoImage = React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    React.createElement(View, { ...props, ref }),
  );
  ExpoImage.displayName = 'ExpoImage';
  return {
    __esModule: true,
    Image: ExpoImage,
  };
});
`;

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function write(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

function exists(p) {
  return fs.existsSync(p);
}

function unlockOrientationInConfig(text) {
  let out = text;
  let changed = false;
  if (/orientation:\s*'portrait'/.test(out) || /orientation:\s*"portrait"/.test(out)) {
    out = out.replace(/orientation:\s*['"]portrait['"]/, "orientation: 'default'");
    changed = true;
  }
  if (!/orientation:\s*'default'/.test(out) && !/orientation:\s*"default"/.test(out)) {
    // Insert after version line when orientation missing
    if (/version:\s*'[^']+'/.test(out)) {
      out = out.replace(/(version:\s*'[^']+',?\n)/, "$1  orientation: 'default',\n");
      changed = true;
    }
  }
  // Comment for large-screen if we just unlocked and no comment nearby
  if (changed && !/Unlock for tablets|large-screen|Play large-screen/.test(out)) {
    out = out.replace(
      /orientation:\s*'default'/,
      "// Unlock for tablets / foldables (Play large-screen). Manifest → unspecified.\n  orientation: 'default'",
    );
  }
  return { text: out, changed };
}

function bumpVersions(text, bump) {
  if (!bump) return { text, changed: false };
  let out = text;
  let changed = false;
  const verRe = /version:\s*'[^']+'/;
  const vcRe = /versionCode:\s*\d+/;
  if (verRe.test(out) && !out.includes(`version: '${bump.version}'`)) {
    out = out.replace(verRe, `version: '${bump.version}'`);
    changed = true;
  }
  if (vcRe.test(out) && !out.includes(`versionCode: ${bump.versionCode}`)) {
    out = out.replace(vcRe, `versionCode: ${bump.versionCode}`);
    changed = true;
  }
  return { text: out, changed };
}

function ensureExpoImagePlugin(text) {
  if (/['"]expo-image['"]/.test(text)) return { text, changed: false };
  let out = text;
  // Prefer insert before withAndroid15PlayCompliance (plain or [plugin, opts] form).
  if (/withAndroid15PlayCompliance/.test(out)) {
    out = out.replace(
      /(\n[ \t]*)(\[?withAndroid15PlayCompliance)/,
      `$1// Glide-backed decode for brand logos (Play bitmap optimization).\n$1'expo-image',\n$1$2`,
    );
  } else if (/plugins:\s*\[/.test(out)) {
    out = out.replace(
      /plugins:\s*\[/,
      `plugins: [\n    // Glide-backed decode for brand logos (Play bitmap optimization).\n    'expo-image',`,
    );
  } else {
    return { text, changed: false, reason: 'no-plugins' };
  }
  return { text: out, changed: true };
}

function unlockManifest(xml) {
  let out = String(xml);
  let changed = false;
  if (/android:screenOrientation\s*=\s*["']portrait["']/.test(out)) {
    out = out.replace(
      /android:screenOrientation\s*=\s*["']portrait["']/g,
      'android:screenOrientation="unspecified"',
    );
    changed = true;
  }
  // Remove resizeableActivity=false if present (Play large-screen)
  if (/android:resizeableActivity\s*=\s*["']false["']/.test(out)) {
    out = out.replace(/\s*android:resizeableActivity\s*=\s*["']false["']/g, '');
    changed = true;
  }
  return { text: out, changed };
}

function patchLoginScreen(text) {
  let out = text;
  let changed = false;

  if (!out.includes("from 'react-native'") && !out.includes('from "react-native"')) {
    return { text, changed: false, reason: 'no-rn-import' };
  }
  if (out.includes('OptimizedImage') && !/\bImage\b/.test(out.match(/from ['"]react-native['"]/)?.[0] || '')) {
    // Already migrated if no Image in RN import
    const rnImport = out.match(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/);
    if (rnImport && !/\bImage\b/.test(rnImport[1])) {
      return { text, changed: false };
    }
  }

  // Remove Image from RN import list
  const before = out;
  out = out.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/,
    (full, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((name) => name !== 'Image' && !name.startsWith('Image '));
      return `import {\n  ${parts.join(',\n  ')}\n} from 'react-native'`;
    },
  );
  if (out !== before) changed = true;

  if (!out.includes("from '../ui/OptimizedImage'") && !out.includes('from "../ui/OptimizedImage"')) {
    // Insert after last import from react-native-safe-area or after RN import
    if (/import \{ OptimizedImage \}/.test(out) === false) {
      const insert = "import { OptimizedImage } from '../ui/OptimizedImage';\n";
      if (/from ['"]\.\.\/ui\/Button['"]/.test(out)) {
        out = out.replace(
          /(import \{ Button \} from ['"]\.\.\/ui\/Button['"];\n)/,
          `$1${insert}`,
        );
      } else if (/from ['"]react-native-safe-area-context['"];\n/.test(out)) {
        out = out.replace(
          /(from ['"]react-native-safe-area-context['"];\n)/,
          `$1${insert}`,
        );
      } else {
        out = out.replace(
          /(from ['"]react-native['"];\n)/,
          `$1${insert}`,
        );
      }
      changed = true;
    }
  }

  // Replace brand Image blocks that use resizeMode="contain"
  if (/<Image\b[\s\S]*?resizeMode=["']contain["']/.test(out)) {
    out = out.replace(/<Image(\b[\s\S]*?)resizeMode=["']contain["']/g, '<OptimizedImage$1contentFit="contain"');
    // Self-closing already OK; also handle if Image became OptimizedImage with leftover
    changed = true;
  }

  return { text: out, changed };
}

function patchBrandMark(text) {
  let out = text;
  let changed = false;
  if (!out.includes("from 'react-native'") || !/\bImage\b/.test(out)) {
    return { text, changed: false };
  }
  if (out.includes('OptimizedImage')) return { text, changed: false };

  out = out.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/,
    (full, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((name) => name !== 'Image');
      return `import { ${parts.join(', ')} } from 'react-native'`;
    },
  );
  if (!out.includes('OptimizedImage')) {
    out = out.replace(
      /(from ['"]react-native['"];\n)/,
      `$1import { OptimizedImage } from '../ui/OptimizedImage';\n`,
    );
  }
  out = out.replace(
    /<Image(\b[\s\S]*?)resizeMode=["']contain["']/,
    '<OptimizedImage$1contentFit="contain"',
  );
  changed = true;
  return { text: out, changed };
}

function ensurePackageDep(pkgPath) {
  const pkg = JSON.parse(read(pkgPath));
  let changed = false;
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies['expo-image']) {
    pkg.dependencies['expo-image'] = EXPO_IMAGE;
    changed = true;
  }
  // Sort deps? keep insertion order — npm will reorder on install
  if (changed) {
    write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  return changed;
}

function ensureJestMock(appDir) {
  const setupCandidates = ['jest.setup.ts', 'jest.setup.js'].map((n) => path.join(appDir, n));
  const setup = setupCandidates.find((p) => exists(p));
  if (!setup) return { changed: false, skip: true };
  let text = read(setup);
  if (/jest\.mock\(\s*['"]expo-image['"]/.test(text)) return { changed: false };
  text = `${text.trimEnd()}\n${EXPO_IMAGE_MOCK}\n`;
  write(setup, text);
  return { changed: true };
}

function ensureOptimizedImage(appDir) {
  const uiDir = path.join(appDir, 'src/ui');
  const target = path.join(uiDir, 'OptimizedImage.tsx');
  if (exists(target)) return { changed: false };
  if (!exists(path.join(appDir, 'src'))) return { changed: false, skip: true };
  write(target, OPTIMIZED_IMAGE_SRC);
  return { changed: true };
}

function complianceTestSrc(appLabel) {
  return `import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const androidRoot = path.join(root, 'android');
const hasAndroidTree = fs.existsSync(androidRoot);

const RN_IMAGE_IMPORT =
  /import\\s*\\{[^}]*\\bImage\\b[^}]*\\}\\s*from\\s*['"]react-native['"]/;

/**
 * Play Console recommendations for ${appLabel}:
 * edge-to-edge, large-screen orientation, bitmap (expo-image), R8.
 */
describe('Android Play compliance toolchain (${appLabel})', () => {
  it('unlocks orientation for large screens (no portrait lock)', () => {
    const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(appConfig).toMatch(/orientation:\\s*'default'/);
    expect(appConfig).not.toMatch(/orientation:\\s*'portrait'/);

    const appJsonPath = path.join(root, 'app.json');
    if (fs.existsSync(appJsonPath)) {
      const appJson = fs.readFileSync(appJsonPath, 'utf8');
      expect(appJson).not.toMatch(/"orientation"\\s*:\\s*"portrait"/);
    }
  });

  it('depends on expo-image for downsampled bitmap loading', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.dependencies['expo-image']).toBeTruthy();
    expect(fs.existsSync(path.join(root, 'src/ui/OptimizedImage.tsx'))).toBe(true);
  });

  it('OptimizedImage wraps expo-image with memory-disk cache', () => {
    const src = fs.readFileSync(path.join(root, 'src/ui/OptimizedImage.tsx'), 'utf8');
    expect(src).toMatch(/from 'expo-image'/);
    expect(src).toMatch(/cachePolicy\\s*=\\s*'memory-disk'/);
    expect(src).not.toMatch(/from 'react-native'/);
  });

  it('wires the shared Android 15 Play compliance plugin + RN edge patch', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(config).toMatch(/withAndroid15PlayCompliance/);
    expect(config).toMatch(/['"]expo-image['"]/);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['patch:rn-edge']).toMatch(/patch-rn-edge-to-edge/);
    expect(pkg.scripts.postinstall).toMatch(/patch-rn-edge-to-edge/);
  });

  it('src tree does not decode bitmaps with react-native Image', () => {
    const walk = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const out: string[] = [];
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else if (/\\.(tsx|ts)$/.test(ent.name)) out.push(p);
      }
      return out;
    };
    const offenders = walk(path.join(root, 'src')).filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return RN_IMAGE_IMPORT.test(text);
    });
    expect(offenders).toEqual([]);
  });

  (hasAndroidTree ? it : it.skip)(
    'android tree: MainActivity orientation is unspecified (not portrait)',
    () => {
      const manifest = fs.readFileSync(
        path.join(androidRoot, 'app/src/main/AndroidManifest.xml'),
        'utf8',
      );
      expect(manifest).not.toMatch(/android:screenOrientation\\s*=\\s*["']portrait["']/i);
      expect(manifest).toMatch(
        /android:name="\\.MainActivity"[^>]*android:screenOrientation="unspecified"/,
      );
    },
  );

  (hasAndroidTree ? it : it.skip)(
    'android tree: R8 minify, shrink, and optimized resource shrinking',
    () => {
      const gradle = fs.readFileSync(path.join(androidRoot, 'gradle.properties'), 'utf8');
      expect(gradle).toMatch(/android\\.enableMinifyInReleaseBuilds\\s*=\\s*true/);
      expect(gradle).toMatch(/android\\.enableShrinkResourcesInReleaseBuilds\\s*=\\s*true/);
      expect(gradle).toMatch(/android\\.r8\\.optimizedResourceShrinking\\s*=\\s*true/);
      expect(gradle).toMatch(/edgeToEdgeEnabled\\s*=\\s*true/);
    },
  );

  (hasAndroidTree ? it : it.skip)(
    'android tree: uses proguard-android-optimize.txt so R8 optimization is on',
    () => {
      const appGradle = fs.readFileSync(path.join(androidRoot, 'app/build.gradle'), 'utf8');
      expect(appGradle).toMatch(/proguard-android-optimize\\.txt/);
      expect(appGradle).not.toMatch(
        /getDefaultProguardFile\\(\\s*["']proguard-android\\.txt["']\\s*\\)/,
      );
    },
  );

  (hasAndroidTree ? it : it.skip)(
    'android tree: strips deprecated edge-to-edge bar colors from styles.xml',
    () => {
      const stylesPath = path.join(androidRoot, 'app/src/main/res/values/styles.xml');
      expect(fs.existsSync(stylesPath)).toBe(true);
      const styles = fs.readFileSync(stylesPath, 'utf8');
      expect(styles).not.toMatch(/<item\\s+name="android:statusBarColor"/);
      expect(styles).not.toMatch(/<item\\s+name="android:navigationBarColor"/);
      expect(styles).not.toMatch(/windowOptOutEdgeToEdgeEnforcement/);
    },
  );
});
`;
}

function ensureComplianceTest(appDir, appId) {
  const candidates = [
    path.join(appDir, 'src/__tests__/androidPlayCompliance.test.ts'),
    path.join(appDir, 'src/test/androidPlayCompliance.test.ts'),
    path.join(appDir, '__tests__/androidPlayCompliance.test.ts'),
  ];
  if (candidates.some((p) => exists(p))) return { changed: false };
  if (!exists(path.join(appDir, 'src'))) return { changed: false, skip: true };
  const target = candidates[0];
  const label = appId
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  write(target, complianceTestSrc(label));
  return { changed: true };
}

function patchAppJson(appDir, bump) {
  const p = path.join(appDir, 'app.json');
  if (!exists(p)) return { changed: false, skip: true };
  const raw = read(p);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { changed: false, reason: 'invalid-json' };
  }
  let changed = false;
  if (data.expo) {
    if (data.expo.orientation === 'portrait' || !data.expo.orientation) {
      data.expo.orientation = 'default';
      changed = true;
    }
    if (bump && data.expo.version !== bump.version) {
      data.expo.version = bump.version;
      changed = true;
    }
  }
  if (changed) write(p, `${JSON.stringify(data, null, 2)}\n`);
  return { changed };
}

function ensurePackageJsonVersion(pkgPath, bump) {
  if (!bump) return false;
  const pkg = JSON.parse(read(pkgPath));
  if (pkg.version === bump.version) return false;
  pkg.version = bump.version;
  write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

function ensureApkPatch(appDir) {
  const apk = path.join(appDir, 'scripts/android-apk.sh');
  if (!exists(apk)) return { changed: false, skip: true };
  let text = read(apk);
  if (/patch:rn-edge|patch-rn-edge-to-edge/.test(text)) return { changed: false };
  const block = `echo "==> Android 15 / Play: ensure RN edge-to-edge sources are patched"
npm run patch:rn-edge

`;
  if (text.includes('echo "==> Building release APK"')) {
    text = text.replace('echo "==> Building release APK"', `${block}echo "==> Building release APK"`);
  } else if (text.includes('./gradlew assembleRelease')) {
    text = text.replace('./gradlew assembleRelease', `${block}./gradlew assembleRelease`);
  } else {
    return { changed: false, reason: 'no-anchor' };
  }
  write(apk, text);
  return { changed: true };
}

const appIds = [...new Set([...Object.keys(fleetProfiles), ...EXTRA_APPS])];
const report = [];

for (const appId of appIds) {
  const appDir = path.join(mobileRoot, appId);
  const row = { appId, changes: [] };
  if (!exists(appDir)) {
    row.status = 'missing';
    report.push(row);
    continue;
  }

  const bump = VERSION_BUMPS[appId];
  const configPath = ['app.config.ts', 'app.config.js']
    .map((n) => path.join(appDir, n))
    .find((p) => exists(p));

  if (configPath) {
    let text = read(configPath);
    const orient = unlockOrientationInConfig(text);
    text = orient.text;
    if (orient.changed) row.changes.push('orientation');

    const ver = bumpVersions(text, bump);
    text = ver.text;
    if (ver.changed) row.changes.push('version');

    const plugin = ensureExpoImagePlugin(text);
    text = plugin.text;
    if (plugin.changed) row.changes.push('expo-image-plugin');

    if (orient.changed || ver.changed || plugin.changed) write(configPath, text);
  }

  const pkgPath = path.join(appDir, 'package.json');
  if (exists(pkgPath)) {
    if (ensurePackageDep(pkgPath)) row.changes.push('expo-image-dep');
    if (ensurePackageJsonVersion(pkgPath, bump)) row.changes.push('pkg-version');
  }

  const aj = patchAppJson(appDir, bump);
  if (aj.changed) row.changes.push('app.json');

  const manifest = path.join(appDir, 'android/app/src/main/AndroidManifest.xml');
  if (exists(manifest)) {
    const m = unlockManifest(read(manifest));
    if (m.changed) {
      write(manifest, m.text);
      row.changes.push('manifest-orient');
    }
  }

  const oi = ensureOptimizedImage(appDir);
  if (oi.changed) row.changes.push('OptimizedImage');

  const login = path.join(appDir, 'src/screens/LoginScreen.tsx');
  if (exists(login)) {
    const p = patchLoginScreen(read(login));
    if (p.changed) {
      write(login, p.text);
      row.changes.push('LoginScreen');
    }
  }

  const brand = path.join(appDir, 'src/components/BrandMark.tsx');
  if (exists(brand)) {
    const p = patchBrandMark(read(brand));
    if (p.changed) {
      write(brand, p.text);
      row.changes.push('BrandMark');
    }
  }

  const mock = ensureJestMock(appDir);
  if (mock.changed) row.changes.push('jest-mock');

  const test = ensureComplianceTest(appDir, appId);
  if (test.changed) row.changes.push('compliance-test');

  const apk = ensureApkPatch(appDir);
  if (apk.changed) row.changes.push('android-apk');

  report.push(row);
}

for (const row of report) {
  if (row.status === 'missing') {
    console.log(`${row.appId.padEnd(28)} MISSING`);
    continue;
  }
  console.log(
    `${row.appId.padEnd(28)} ${row.changes.length ? row.changes.join(', ') : 'unchanged'}`,
  );
}

console.log('\nFleet large-screen + bitmap wiring complete.');
