import {
  cacheBackedPackId,
  isCacheBackedPackId,
  runTileCacheSweep,
} from '../src/lib/offline/tileCacheDownload';
import { resetDownloadMapHostForTests, registerDownloadMapController } from '../src/lib/offline/downloadMapHost';

jest.mock('../src/lib/network/mapLibreNetworkGate', () => ({
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

describe('tileCacheDownload', () => {
  beforeEach(() => {
    resetDownloadMapHostForTests();
  });

  it('identifies cache-backed pack ids', () => {
    expect(cacheBackedPackId('kiel-bay')).toBe('cache:kiel-bay');
    expect(isCacheBackedPackId('cache:kiel-bay')).toBe(true);
    expect(isCacheBackedPackId('native-pack-id')).toBe(false);
  });

  it('reports progress while sweeping tiles', async () => {
    const { markDownloadMapStyleLoaded } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
    };
    markDownloadMapStyleLoaded('file:///style.json');
    registerDownloadMapController({
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });

    const progress: number[] = [];
    const result = await runTileCacheSweep({
      chartStyleUri: 'file:///style.json',
      bounds: [10.05, 54.22, 10.06, 54.23],
      minZoom: 10,
      maxZoom: 10,
      isCancelled: () => false,
      onProgress: (p) => progress.push(p.percentage),
    });

    expect(result.percentage).toBe(100);
    expect(progress.some((p) => p > 0)).toBe(true);
  });
});
