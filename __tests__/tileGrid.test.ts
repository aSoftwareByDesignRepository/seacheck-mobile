import { enumerateTileViewports, firstTileViewport } from '../src/lib/offline/tileGrid';

describe('tileGrid', () => {
  const kielBounds: [number, number, number, number] = [10.05, 54.22, 10.25, 54.42];

  it('enumerates unique tile viewports across zoom levels', () => {
    const viewports = enumerateTileViewports(kielBounds, 10, 11);
    expect(viewports.length).toBeGreaterThan(0);
    const keys = new Set(viewports.map((v) => v.key));
    expect(keys.size).toBe(viewports.length);
    for (const viewport of viewports) {
      expect(viewport.center).toHaveLength(2);
      expect(viewport.zoom).toBeGreaterThanOrEqual(10);
      expect(viewport.zoom).toBeLessThanOrEqual(11);
    }
  });

  it('returns the first tile viewport at min zoom', () => {
    const viewport = firstTileViewport(kielBounds, 10);
    expect(viewport.zoom).toBe(10);
    expect(viewport.key).toMatch(/^10\//);
  });
});
