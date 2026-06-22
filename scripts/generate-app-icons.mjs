#!/usr/bin/env node
// Regenerate PNG app icons from assets/source/*.svg using @resvg/resvg-js.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'source');
const OUT = join(ROOT, 'assets');

function render(input, output, size) {
  const svg = readFileSync(join(SRC, input), 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT, output), png);
  console.log(`Wrote ${output} (${size}x${size})`);
}

const jobs = [
  ['icon-full.svg', 'icon.png', 1024],
  ['icon-full.svg', 'splash-icon.png', 1024],
  ['icon-full.svg', 'favicon.png', 48],
  ['brand-mark.svg', 'brand-logo.png', 256],
  ['icon-foreground.svg', 'android-icon-foreground.png', 512],
  ['icon-background.svg', 'android-icon-background.png', 512],
  ['icon-monochrome.svg', 'android-icon-monochrome.png', 432],
];

for (const [input, output, size] of jobs) {
  render(input, output, size);
}

console.log('Done. Icons: navy gradient, headphones mark, compliance check badge.');
