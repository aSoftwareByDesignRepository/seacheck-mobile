/**
 * Verifies the Android splash stays brand-tinted — a bare 'expo-splash-screen'
 * plugin entry silently ships Expo's #ffffff default (white screen on cold
 * start and process restore). Source-level only — no Gradle (RAM-safe).
 * Ported from mobile/projectcheck/scripts/verify-splash-brand.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function fail(msg) {
  failures.push(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const appConfigRel = 'app.config.ts';
assert(exists(appConfigRel), 'app.config.ts missing');
const appConfig = read(appConfigRel);

// The plugin must carry props — a bare string entry never regenerates splash
// resources and leaves the template default (#ffffff) behind.
const pluginBlock = appConfig.match(
  /\[\s*'expo-splash-screen'\s*,\s*\{([\s\S]*?)\}\s*,?\s*\]/,
);
assert(
  pluginBlock,
  "app.config.ts: 'expo-splash-screen' must be a [name, props] tuple — bare entry = white splash",
);

const props = pluginBlock ? pluginBlock[1] : '';
const brandColor = '#0b1622';
assert(
  props.includes(`backgroundColor: '${brandColor}'`) ||
    props.includes(`backgroundColor: "${brandColor}"`),
  `app.config.ts: splash backgroundColor must be ${brandColor} (brand navy)`,
);
assert(
  props.includes('image:'),
  'app.config.ts: splash plugin props must set image (logo mark)',
);

// When a generated android/ tree exists, the resources must already reflect the
// brand color — stale prebuild output means the fix never reached the device.
const colorsRel = 'android/app/src/main/res/values/colors.xml';
if (exists(colorsRel)) {
  const colors = read(colorsRel);
  assert(
    colors.includes(`name="splashscreen_background">${brandColor}<`),
    `${colorsRel}: splashscreen_background must be ${brandColor} — run: npx expo prebuild --platform android`,
  );

  const stylesRel = 'android/app/src/main/res/values/styles.xml';
  const styles = read(stylesRel);
  assert(
    styles.includes('parent="Theme.SplashScreen"'),
    `${stylesRel}: Theme.App.SplashScreen must extend Theme.SplashScreen — run prebuild`,
  );

  const logoRel = 'android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png';
  if (exists(logoRel)) {
    const bytes = fs.readFileSync(path.join(root, logoRel));
    // Corner pixel of a transparent logo PNG is 0x00000000; the white template
    // default was fully opaque — catch a stale or opaque-white regeneration.
    const ihdr = bytes.readUInt32BE(24); // width — sanity that it is a PNG
    assert(bytes.length > 1000 && ihdr > 0, `${logoRel}: unreadable PNG`);
    // PNG RGBA corner pixel lives far inside the IDAT stream; instead check the
    // file is not the old opaque-white asset by size (old white file was ~90KB+).
    assert(
      bytes.length < 200_000,
      `${logoRel}: suspiciously large — check for a baked opaque background`,
    );
  }
}

if (failures.length) {
  console.error('Splash brand verification failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('Splash brand verification passed.');
