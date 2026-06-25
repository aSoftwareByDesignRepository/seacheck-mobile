#!/usr/bin/env node
// Regenerate PNG app icons from assets/source/*.svg using @resvg/resvg-js.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'source');
const OUT = join(ROOT, 'assets');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const SPLASH_BACKGROUND = '#0b1622';

function renderSvg(input, outputPath, size) {
  const svg = readFileSync(join(SRC, input), 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  writeFileSync(outputPath, png);
  const rel = outputPath.startsWith(ROOT) ? outputPath.slice(ROOT.length + 1) : outputPath;
  console.log(`Wrote ${rel} (${size}x${size})`);
}

const assetJobs = [
  ['icon-full.svg', 'icon.png', 1024],
  ['icon-full.svg', 'splash-icon.png', 1024],
  ['icon-full.svg', 'favicon.png', 48],
  ['brand-mark.svg', 'brand-logo.png', 256],
  ['icon-foreground.svg', 'android-icon-foreground.png', 512],
  ['icon-background.svg', 'android-icon-background.png', 512],
  ['icon-monochrome.svg', 'android-icon-monochrome.png', 432],
];

for (const [input, output, size] of assetJobs) {
  renderSvg(input, join(OUT, output), size);
}

if (existsSync(ANDROID_RES)) {
  const splashDensities = [
    ['drawable-mdpi', 288],
    ['drawable-hdpi', 432],
    ['drawable-xhdpi', 576],
    ['drawable-xxhdpi', 864],
    ['drawable-xxxhdpi', 1152],
  ];
  const notificationDensities = [
    ['drawable-mdpi', 24],
    ['drawable-hdpi', 36],
    ['drawable-xhdpi', 48],
    ['drawable-xxhdpi', 72],
    ['drawable-xxxhdpi', 96],
  ];

  for (const [dir, size] of splashDensities) {
    renderSvg('brand-mark.svg', join(ANDROID_RES, dir, 'splashscreen_logo.png'), size);
  }
  for (const [dir, size] of notificationDensities) {
    renderSvg('icon-monochrome.svg', join(ANDROID_RES, dir, 'notification_icon.png'), size);
  }

  const colorsPath = join(ANDROID_RES, 'values', 'colors.xml');
  if (existsSync(colorsPath)) {
    const colors = readFileSync(colorsPath, 'utf8');
    const next = colors.replace(
      /<color name="splashscreen_background">[^<]+<\/color>/,
      `<color name="splashscreen_background">${SPLASH_BACKGROUND}</color>`,
    );
    if (next !== colors) {
      writeFileSync(colorsPath, next);
      console.log(`Updated android splash background to ${SPLASH_BACKGROUND}`);
    }
  }

  console.log('Syncing Android adaptive launcher icons (expo prebuild)...');
  execSync('npx expo prebuild --platform android --no-install', {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('Done. Icons: ocean-navy gradient, compass rose (north accent #0073ad).');
console.log('Rebuild the native app to refresh the launcher icon on device: npm run android:rebuild');
