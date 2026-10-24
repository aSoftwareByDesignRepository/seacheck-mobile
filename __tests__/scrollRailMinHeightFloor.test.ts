import fs from 'fs';
import path from 'path';

/**
 * Regression pin for flex_child_no_min_height_floor (Atlas 2026-10-24):
 * scroll={false} Screens keep a flex:1 scroll rail below taller siblings
 * (sticky download banner, long localized title/subtitle wraps). Without a
 * minHeight floor the rail can be crushed to unusable height while the
 * sibling keeps its space. Floor = >=200px usable scroll (farm convention).
 */
describe('scroll rail min-height floor on non-scroll Screens', () => {
  it('DownloadsScreen pack rail carries an explicit >=200px floor', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/screens/DownloadsScreen.tsx'), 'utf8');
    const rail = src.match(/<ScrollView[\s\S]*?style=\{\{\s*flex:\s*1,\s*minHeight:\s*(\d+)/);
    expect(rail).not.toBeNull();
    expect(Number(rail![1])).toBeGreaterThanOrEqual(200);
  });

  it('PassageListScreen FlatList carries an explicit >=200px floor', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/screens/passage/PassageListScreen.tsx'), 'utf8');
    const list = src.match(/list:\s*\{([\s\S]*?)\}/);
    expect(list).not.toBeNull();
    expect(list![1]).toMatch(/flex:\s*1/);
    const min = list![1].match(/minHeight:\s*(\d+)/);
    expect(min).not.toBeNull();
    expect(Number(min![1])).toBeGreaterThanOrEqual(200);
  });
});
