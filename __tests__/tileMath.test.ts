import {
  estimateDownloadKb,
  estimateTileCount,
  formatRasterTileUrl,
  formatStorageSize,
  tileCoordsAt,
} from '../src/map/tileMath';

describe('tileMath', () => {
  it('estimates tile count for Kiel bbox', () => {
    const count = estimateTileCount([10.05, 54.22, 10.25, 54.42], 10, 12);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(5000);
  });

  it('computes web-mercator tile coords and raster URL templates', () => {
    const { x, y } = tileCoordsAt(10.141, 54.323, 10);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(formatRasterTileUrl('https://example/{z}/{x}/{y}.png', 10, x, y)).toBe(
      `https://example/10/${x}/${y}.png`,
    );
  });

  it('estimates download size labels', () => {
    expect(estimateDownloadKb(10, 28)).toBe(280);
    expect(formatStorageSize(512)).toBe('512 KB');
    expect(formatStorageSize(2048)).toMatch(/MB$/);
    expect(formatStorageSize(2 * 1024 * 1024)).toMatch(/GB$/);
  });
});
