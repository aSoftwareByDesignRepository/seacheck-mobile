/**
 * Regression probe for seed defect sc-vis-pack-row-vertical-glyph-clip:
 * pack titles must render as a full-width single line — never squeezed into
 * a 1-glyph vertical column by badge siblings, and lineHeight must leave
 * room for descenders (Atlas avd_craft re-proof 2026-10-02).
 */
import fs from 'fs';
import path from 'path';

const readSrc = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('downloads pack-title glyph-clip fix (DS — seed defect)', () => {
  it('titleRow is a column stack so the name is never squeezed by badges', () => {
    const src = readSrc('src/features/downloads/downloadsStyles.ts');
    expect(src).toMatch(/titleRow:\s*\{\s*flexDirection:\s*'column'/);
  });

  it('packName lineHeight leaves descender room (>= fontSize + 6)', () => {
    const src = readSrc('src/features/downloads/downloadsStyles.ts');
    const m = src.match(/packName:\s*\{[^}]*fontSize:\s*(\d+)[^}]*lineHeight:\s*(\d+)/);
    expect(m).not.toBeNull();
    const fontSize = Number(m![1]);
    const lineHeight = Number(m![2]);
    expect(lineHeight).toBeGreaterThanOrEqual(fontSize + 6);
  });

  it('RegionPackCard renders the name inside the column title row', () => {
    const src = readSrc('src/features/downloads/RegionPackCard.tsx');
    expect(src).toMatch(/downloadsStyles\.titleRow/);
    expect(src).toMatch(/downloadsStyles\.packName/);
  });

  it('CustomPackCard renders the name inside the column title row', () => {
    const src = readSrc('src/features/downloads/CustomPackCard.tsx');
    expect(src).toMatch(/downloadsStyles\.titleRow/);
    expect(src).toMatch(/downloadsStyles\.packName/);
  });
});
