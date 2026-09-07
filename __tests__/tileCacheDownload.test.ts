import {
  cacheBackedPackId,
  isCacheBackedPackId,
  resolveSweepStartIndex,
  runTileCacheSweep,
  TILE_SWEEP_PLAN_VERSION,
} from '../src/lib/offline/tileCacheDownload';
import { resetDownloadMapHostForTests, registerDownloadMapController } from '../src/lib/offline/downloadMapHost';
import { resetDownloadMapSlotForTests, setDownloadMapMapClaim } from '../src/lib/offline/downloadMapSlot';

jest.mock('../src/lib/network/mapLibreNetworkGate', () => ({
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

describe('tileCacheDownload', () => {
  beforeEach(() => {
    resetDownloadMapHostForTests();
    resetDownloadMapSlotForTests();
    setDownloadMapMapClaim(true);
  });

  it('identifies cache-backed pack ids', () => {
    expect(cacheBackedPackId('kiel-bay')).toBe('cache:kiel-bay');
    expect(isCacheBackedPackId('cache:kiel-bay')).toBe(true);
    expect(isCacheBackedPackId('native-pack-id')).toBe(false);
  });

  it('restarts sweep when persisted total does not match the live plan', () => {
    expect(resolveSweepStartIndex(200, 54, 249)).toBe(0);
    expect(resolveSweepStartIndex(20, 54, 54)).toBe(0); // legacy: no plan version
    expect(resolveSweepStartIndex(200, 54, 54, TILE_SWEEP_PLAN_VERSION)).toBe(54);
    expect(resolveSweepStartIndex(10, 54, 54, 1)).toBe(0);
    expect(resolveSweepStartIndex(10, 54, 54, TILE_SWEEP_PLAN_VERSION)).toBe(10);
    expect(resolveSweepStartIndex(0, 54, 249)).toBe(0);
  });

  it('reports progress while sweeping every tile viewport', async () => {
    const { markDownloadMapStyleLoaded, markDownloadMapFrameRendered } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
      markDownloadMapFrameRendered: () => void;
    };
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    const showTile = jest.fn(async () => {});
    registerDownloadMapController({
      showTile,
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
    expect(showTile).toHaveBeenCalled();
    expect(progress.some((p) => p > 0)).toBe(true);
  });

  it('visits more than one viewport when the pack spans multiple tiles', async () => {
    const { markDownloadMapStyleLoaded, markDownloadMapFrameRendered } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
      markDownloadMapFrameRendered: () => void;
    };
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    const showTile = jest.fn(async () => {});
    registerDownloadMapController({
      showTile,
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });

    await runTileCacheSweep({
      chartStyleUri: 'file:///style.json',
      bounds: [10.05, 54.22, 10.25, 54.42],
      minZoom: 10,
      maxZoom: 11,
      isCancelled: () => false,
      onProgress: () => {},
    });

    // Kiel-sized box at z10–11 is more than a single center jump per zoom.
    expect(showTile.mock.calls.length).toBeGreaterThan(2);
  });

  it('does not advance progress on a dead controller after generation bump', async () => {
    const host = require('../src/lib/offline/downloadMapHost') as typeof import('../src/lib/offline/downloadMapHost');
    host.markDownloadMapStyleLoaded('file:///style.json');
    host.markDownloadMapFrameRendered();

    let calls = 0;
    const showTile = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        host.invalidateDownloadMapGeneration();
        host.markDownloadMapStyleLoaded('file:///style.json');
        host.markDownloadMapFrameRendered();
        host.registerDownloadMapController({
          generation: host.getDownloadMapGeneration(),
          showTile: jest.fn(async () => {}),
          fitBounds: jest.fn(async () => {}),
          waitForFrame: jest.fn(async () => {}),
        });
      }
    });
    host.registerDownloadMapController({
      generation: host.getDownloadMapGeneration(),
      showTile,
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });

    const result = await runTileCacheSweep({
      chartStyleUri: 'file:///style.json',
      bounds: [10.05, 54.22, 10.06, 54.23],
      minZoom: 10,
      maxZoom: 10,
      isCancelled: () => false,
      onProgress: () => {},
    });

    expect(result.percentage).toBe(100);
    expect(showTile.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('requests two paint frames per hop for integrity', async () => {
    const { markDownloadMapStyleLoaded, markDownloadMapFrameRendered } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
      markDownloadMapFrameRendered: () => void;
    };
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    const waitForFrame = jest.fn(async () => {});
    registerDownloadMapController({
      showTile: jest.fn(async () => {}),
      fitBounds: jest.fn(async () => {}),
      waitForFrame,
    });

    await runTileCacheSweep({
      chartStyleUri: 'file:///style.json',
      bounds: [10.05, 54.22, 10.06, 54.23],
      minZoom: 10,
      maxZoom: 10,
      isCancelled: () => false,
      onProgress: () => {},
    });

    expect(waitForFrame.mock.calls.some((args) => args[0] === 2)).toBe(true);
  });
});
