import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const androidRoot = path.join(root, 'android');
const hasAndroidTree = fs.existsSync(androidRoot);

describe('Android Play compliance toolchain (SeaCheck)', () => {
  it('unlocks orientation for large screens (no portrait lock)', () => {
    const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(appConfig).toMatch(/orientation:\s*'default'/);
    expect(appConfig).not.toMatch(/orientation:\s*'portrait'/);
  });

  it('wires the shared Android 15 Play compliance plugin (keepBoot for TaskManager)', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(config).toMatch(/withAndroid15PlayCompliance/);
    expect(config).toMatch(/profile:\s*'keepBoot'/);
    expect(config).toMatch(/withAndroidReleaseSigning/);
  });

  it('patches RN edge-to-edge deprecated Window APIs in release scripts and postinstall', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['patch:rn-edge']).toMatch(/patch-rn-edge-to-edge/);
    expect(pkg.scripts.postinstall).toMatch(/patch-rn-edge-to-edge/);
    expect(pkg.scripts['optimize:android-bitmaps']).toMatch(/optimize-android-bitmaps/);
    expect(pkg.scripts['android:apk']).toMatch(/android-apk/);
    expect(pkg.scripts['android:bundle']).toMatch(/android-bundle/);
    expect(pkg.scripts['android:release']).toMatch(/play-android-prepare/);

    const preflight = fs.readFileSync(path.join(root, 'scripts/preflight.sh'), 'utf8');
    expect(preflight).toMatch(/patch:rn-edge|patch-rn-edge-to-edge/);

    const prepare = fs.readFileSync(path.join(root, 'scripts/play-android-prepare.sh'), 'utf8');
    expect(prepare).toMatch(/patchAndroidTree/);
    expect(prepare).toMatch(/optimize-android-bitmaps/);
    expect(prepare).toMatch(/patch:rn-edge/);

    const releaseApk = fs.readFileSync(path.join(root, 'scripts/release-apk.sh'), 'utf8');
    expect(releaseApk).toMatch(/play-android-prepare/);

    const apk = fs.readFileSync(path.join(root, 'scripts/android-apk.sh'), 'utf8');
    expect(apk).toMatch(/play-android-prepare/);

    const bundle = fs.readFileSync(path.join(root, 'scripts/android-bundle.sh'), 'utf8');
    expect(bundle).toMatch(/play-android-prepare/);
  });

  (hasAndroidTree ? it : it.skip)(
    'android tree: R8 minify, shrink, and optimized resource shrinking',
    () => {
      const gradle = fs.readFileSync(path.join(androidRoot, 'gradle.properties'), 'utf8');
      expect(gradle).toMatch(/android\.enableMinifyInReleaseBuilds\s*=\s*true/);
      expect(gradle).toMatch(/android\.enableShrinkResourcesInReleaseBuilds\s*=\s*true/);
      expect(gradle).toMatch(/android\.r8\.optimizedResourceShrinking\s*=\s*true/);
    },
  );

  (hasAndroidTree ? it : it.skip)(
    'android tree: uses proguard-android-optimize.txt so R8 optimization is on',
    () => {
      const appGradle = fs.readFileSync(path.join(androidRoot, 'app/build.gradle'), 'utf8');
      expect(appGradle).toMatch(/proguard-android-optimize\.txt/);
      expect(appGradle).not.toMatch(
        /getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/,
      );
    },
  );

  (hasAndroidTree ? it : it.skip)(
    'android tree: strips deprecated edge-to-edge bar colors from styles.xml',
    () => {
      const styles = fs.readFileSync(
        path.join(androidRoot, 'app/src/main/res/values/styles.xml'),
        'utf8',
      );
      expect(styles).not.toMatch(/<item\s+name="android:statusBarColor"/);
      expect(styles).not.toMatch(/<item\s+name="android:navigationBarColor"/);
    },
  );
});
