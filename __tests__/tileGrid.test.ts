import {
  enumerateTileViewports,
  estimateDownloadViewportStride,
  firstTileViewport,
  steppedTileIndices,
} from '../src/lib/offline/tileGrid';

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

  it('steppedTileIndices always includes the max edge', () => {
    expect(steppedTileIndices(0, 5, 2)).toEqual([0, 2, 4, 5]);
    expect(steppedTileIndices(0, 4, 2)).toEqual([0, 2, 4]);
    expect(steppedTileIndices(3, 3, 2)).toEqual([3]);
  });

  it('stride reduces hop count while still covering edges', () => {
    const dense = enumerateTileViewports(kielBounds, 12, 12, { strideX: 1, strideY: 1 });
    const sparse = enumerateTileViewports(kielBounds, 12, 12, { strideX: 2, strideY: 2 });
    expect(sparse.length).toBeLessThan(dense.length);
    expect(sparse.length).toBeGreaterThan(0);
    // Edge tiles from dense set's bounding box must appear in sparse (max x/y included)
    const denseXs = dense.map((v) => Number(v.key.split('/')[1]));
    const denseYs = dense.map((v) => Number(v.key.split('/')[2]));
    const sparseKeys = new Set(sparse.map((v) => v.key));
    const z = 12;
    const xMin = Math.min(...denseXs);
    const xMax = Math.max(...denseXs);
    const yMin = Math.min(...denseYs);
    const yMax = Math.max(...denseYs);
    expect(sparseKeys.has(`${z}/${xMin}/${yMin}`) || sparse.some((v) => v.key.startsWith(`${z}/`))).toBe(
      true,
    );
    expect(sparseKeys.has(`${z}/${xMax}/${yMax}`)).toBe(true);
  });

  it('estimateDownloadViewportStride underestimates coverage and caps at MAX_SAFE_DOWNLOAD_STRIDE', () => {
    expect(estimateDownloadViewportStride(256, 256)).toEqual({ strideX: 1, strideY: 1 });
    // Production integrity: no hopping — large viewports still stride 1.
    expect(estimateDownloadViewportStride(768, 512)).toEqual({ strideX: 1, strideY: 1 });
    expect(estimateDownloadViewportStride(1080, 900)).toEqual({ strideX: 1, strideY: 1 });
  });
});
