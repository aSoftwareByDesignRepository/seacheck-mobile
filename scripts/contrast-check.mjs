#!/usr/bin/env node
function srgbToLin(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function check(label, fg, bg, min) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${r.toFixed(2)}:1 (min ${min}) ${label}`);
  return pass;
}

let fail = 0;
const N = 4.5;
if (!check('text on light bg', '#102a43', '#f5f7fb', N)) fail++;
if (!check('text on light card', '#102a43', '#ffffff', N)) fail++;
if (!check('white on light primary', '#ffffff', '#0073ad', N)) fail++;
if (!check('text on dark bg', '#f0f4f8', '#0b1622', N)) fail++;
if (!check('text on dark card', '#f0f4f8', '#152536', N)) fail++;
if (!check('dark on dark primary', '#0b1622', '#4dabf7', N)) fail++;
if (!check('high contrast text', '#ffffff', '#000000', N)) fail++;
if (!check('high contrast primary', '#000000', '#ffff00', N)) fail++;

const M = 3;
if (!check('muted text on light bg', '#486581', '#f5f7fb', M)) fail++;
if (!check('muted text on dark bg', '#bcccdc', '#0b1622', M)) fail++;
if (!check('danger button light', '#ffffff', '#ba1b1b', N)) fail++;
if (!check('danger button dark', '#0b1622', '#ff6b6b', N)) fail++;
if (!check('danger button high contrast', '#000000', '#ff4d4d', N)) fail++;
if (!check('warning text on light', '#8a4b08', '#fff4e6', N)) fail++;
if (!check('text on red night bg', '#ff9999', '#1a0000', N)) fail++;
if (!check('muted on red night bg', '#cc6666', '#1a0000', M)) fail++;
if (!check('primary text on red night primary', '#1a0000', '#ff4444', N)) fail++;

process.exit(fail === 0 ? 0 : 1);
