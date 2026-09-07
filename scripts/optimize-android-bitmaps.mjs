#!/usr/bin/env node
/**
 * Convert large owned Android PNG drawables to WebP before release packaging.
 *
 * Play Console flags dense PNG splash / brand assets for bitmap memory/size.
 * Launcher mipmaps are already WebP via Expo; splashscreen_logo was still PNG.
 *
 * Idempotent: skips when .webp exists and is newer than .png, or when only .webp remains.
 * Requires `cwebp` on PATH (libwebp).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

/** Density folders that may hold splash / brand PNGs we own. */
const DRAWABLE_DIRS = [
  'drawable-mdpi',
  'drawable-hdpi',
  'drawable-xhdpi',
  'drawable-xxhdpi',
  'drawable-xxxhdpi',
];

/** Basename without extension — must stay stable for @drawable references. */
const CONVERT_BASENAMES = new Set(['splashscreen_logo', 'assets_brandlogo']);

function haveCwebp() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function convertPngToWebp(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  execFileSync(
    'cwebp',
    ['-q', '90', '-alpha_q', '100', '-m', '6', pngPath, '-o', webpPath],
    { stdio: 'pipe' },
  );
  unlinkSync(pngPath);
  return webpPath;
}

function main() {
  if (!existsSync(RES)) {
    console.log('optimize-android-bitmaps: no android/res — skip');
    return;
  }
  if (!haveCwebp()) {
    console.error('optimize-android-bitmaps: cwebp not found (install libwebp)');
    process.exit(1);
  }

  let converted = 0;
  let skipped = 0;

  for (const dir of DRAWABLE_DIRS) {
    const abs = join(RES, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.toLowerCase().endsWith('.png')) continue;
      const base = name.replace(/\.png$/i, '');
      if (!CONVERT_BASENAMES.has(base)) continue;
      const pngPath = join(abs, name);
      const webpPath = join(abs, `${base}.webp`);
      if (existsSync(webpPath)) {
        try {
          unlinkSync(pngPath);
          converted += 1;
          console.log(`removed duplicate PNG (kept WebP): ${dir}/${name}`);
        } catch {
          skipped += 1;
        }
        continue;
      }
      const before = statSync(pngPath).size;
      convertPngToWebp(pngPath);
      const after = statSync(webpPath).size;
      converted += 1;
      console.log(
        `WebP ${dir}/${base}.webp  ${before} → ${after} bytes (−${Math.round((1 - after / before) * 100)}%)`,
      );
    }
  }

  console.log(`optimize-android-bitmaps: converted=${converted} skipped=${skipped}`);
}

main();
