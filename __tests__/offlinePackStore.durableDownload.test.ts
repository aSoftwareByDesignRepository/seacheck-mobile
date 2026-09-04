import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import { REGION_PACKS } from '../src/map/regionPacks';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { registerDownloadMapController, resetDownloadMapHostForTests } from '../src/lib/offline/downloadMapHost';
import { resetSeamarkIndexQueueForTests } from '../src/lib/seamarks/seamarkIndexQueue';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';

jest.mock('../src/map/chartStyle', () => ({
  ensureChartStyleFile: jest.fn(async () => 'file:///mock/map/chart-style.json'),
}));

jest.mock('../src/lib/seamarks/seamarkIndex', () => ({
  indexSeamarksForPack: jest.fn(async () => 12),
  clearSeamarkIndex: jest.fn(async () => {}),
}));

jest.mock('../src/lib/network/connectivity', () => ({
  fetchIsEffectivelyOnline: jest.fn(async () => false),
}));

jest.mock('../src/lib/network/downloadNetwork', () => ({
  assertNetworkForDownload: jest.fn(async () => {}),
  assertChartDownloadNetworkReady: jest.fn(async () => {}),
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

jest.mock('../src/lib/offline/warmupOfflineEngine', () => ({
  warmupOfflineEngine: jest.fn(async () => {}),
}));

jest.mock('../src/lib/offline/tileCacheDownload', () => {
  const actual = jest.requireActual('../src/lib/offline/tileCacheDownload') as typeof import('../src/lib/offline/tileCacheDownload');
  return {
    ...actual,
    runTileCacheSweep: jest.fn(async ({
      startIndex = 0,
      onProgress,
      isCancelled,
    }: {
      startIndex?: number;
      onProgress?: (p: { completed: number; total: number; percentage: number }) => void;
      isCancelled?: () => boolean;
    }) => {
      const total = 5;
      for (let completed = startIndex; completed <= total; completed++) {
        if (isCancelled?.()) {
          return { completed, total, percentage: Math.round((completed / total) * 100) };
        }
        onProgress?.({
          completed,
          total,
          percentage: Math.round((completed / total) * 100),
        });
      }
      return { completed: total, total, percentage: 100 };
    }),
  };
});

const STORAGE_KEY = 'seacheck.offline.v1';
const KIEL = REGION_PACKS[0]!;

function completeNativeStatus(id: string) {
  return {
    id,
    state: 'complete' as const,
    percentage: 100,
    completedResourceCount: 10,
    completedResourceSize: 1000,
    completedTileCount: 8,
    completedTileSize: 800,
    requiredResourceCount: 10,
  };
}

function incompleteNativeStatus(id: string, percentage = 40) {
  return {
    id,
    state: 'active' as const,
    percentage,
    completedResourceCount: 4,
    completedResourceSize: 400,
    completedTileCount: 3,
    completedTileSize: 300,
    requiredResourceCount: 10,
  };
}

function mockNativePack(
  id: string,
  regionId: string,
  status: ReturnType<typeof completeNativeStatus> | ReturnType<typeof incompleteNativeStatus>,
) {
  let current = status;
  return {
    id,
    metadata: { regionId },
    bounds: KIEL.bounds,
    status: async () => current,
    resume: jest.fn(async () => {
      current = completeNativeStatus(id);
    }),
    pause: jest.fn(async () => {}),
    setStatus(next: typeof current) {
      current = next;
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 8_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('waitFor timeout');
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('offline pack durable ready + kill-mid-download', () => {
  jest.setTimeout(20_000);

  const getPacks = OfflineManager.getPacks as jest.Mock;
  const createPack = OfflineManager.createPack as jest.Mock;
  const clearAmbientCache = OfflineManager.clearAmbientCache as jest.Mock;
  const deletePack = OfflineManager.deletePack as jest.Mock;

  beforeEach(async () => {
    resetSeamarkIndexQueueForTests();
    resetDownloadMapHostForTests();
    resetOfflinePackStoreForTests();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('seacheck.chart.basemapId', 'osm-standard-v1');
    getPacks.mockReset();
    getPacks.mockResolvedValue([]);
    createPack.mockClear();
    clearAmbientCache.mockClear();
    deletePack.mockClear();
    deletePack.mockResolvedValue(undefined);
    const { markDownloadMapStyleLoaded } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
    };
    markDownloadMapStyleLoaded('file:///mock/map/chart-style.json');
    registerDownloadMapController({
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });
  });

  afterEach(async () => {
    downloadCoordinator.invalidate(KIEL.id);
    resetSeamarkIndexQueueForTests();
    resetOfflinePackStoreForTests();
    resetDownloadMapHostForTests();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('marks Ready only after OfflineManager.createPack seals the region', async () => {
    await useOfflinePackStore.getState().hydrate();
    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(createPack).toHaveBeenCalled();
    expect(status?.state).toBe('ready');
    expect(status?.cacheBacked).toBeFalsy();
    expect(status?.packId).toBe('mock-pack');
    expect(status?.percentage).toBe(100);

    const index = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}') as Record<
      string,
      { packId: string; cacheBacked?: boolean }
    >;
    expect(index[KIEL.id]?.packId).toBe('mock-pack');
    expect(index[KIEL.id]?.cacheBacked).toBeUndefined();
  });

  it('keeps Ready after ambient cache clear when a durable pack exists', async () => {
    const pack = mockNativePack('pack-durable', KIEL.id, completeNativeStatus('pack-durable'));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: { packId: 'pack-durable', seamarksIndexed: true },
      }),
    );
    getPacks.mockResolvedValue([pack]);

    await useOfflinePackStore.getState().hydrate();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('ready');

    await OfflineManager.clearAmbientCache();
    resetOfflinePackStoreForTests();
    getPacks.mockResolvedValue([pack]);
    await useOfflinePackStore.getState().hydrate();

    expect(clearAmbientCache).toHaveBeenCalled();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('ready');
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.packId).toBe('pack-durable');
  });

  it('demotes legacy ambient-only Ready packs on hydrate', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: `cache:${KIEL.id}`,
          cacheBacked: true,
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
        },
      }),
    );
    getPacks.mockResolvedValue([]);

    await useOfflinePackStore.getState().hydrate();

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('error');
    expect(status?.error).toMatch(/temporary cache|temporären Cache|download again|erneut/i);
    const index = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}') as Record<string, unknown>;
    expect(index[KIEL.id]).toBeUndefined();
  });

  it('resumes after process death mid tile-sweep and finishes with a durable pack', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: `cache:${KIEL.id}`,
          cacheBacked: true,
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
          sweepCompleted: 2,
          sweepTotal: 5,
        },
      }),
    );
    getPacks.mockResolvedValue([]);

    await useOfflinePackStore.getState().hydrate();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('downloading');
    expect(downloadCoordinator.getActiveRegionId()).toBe(KIEL.id);

    await waitFor(() => useOfflinePackStore.getState().regions[KIEL.id]?.state === 'ready');

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.cacheBacked).toBeFalsy();
    expect(status?.packId).toBe('mock-pack');
    expect(createPack).toHaveBeenCalled();
  });

  it('resumes seal after process death between sweep-complete and createPack', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: `cache:${KIEL.id}`,
          cacheBacked: true,
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
          sweepCompleted: 5,
          sweepTotal: 5,
        },
      }),
    );
    getPacks.mockResolvedValue([]);

    await useOfflinePackStore.getState().hydrate();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('downloading');
    expect(downloadCoordinator.getActiveRegionId()).toBe(KIEL.id);

    await waitFor(() => useOfflinePackStore.getState().regions[KIEL.id]?.state === 'ready');

    expect(createPack).toHaveBeenCalled();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.cacheBacked).toBeFalsy();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.packId).toBe('mock-pack');
  });

  it('resumes after process death mid durable seal', async () => {
    const pack = mockNativePack('pack-sealing', KIEL.id, incompleteNativeStatus('pack-sealing', 35));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: 'pack-sealing',
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
        },
      }),
    );
    getPacks.mockResolvedValue([pack]);

    await useOfflinePackStore.getState().hydrate();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('downloading');
    expect(downloadCoordinator.getActiveRegionId()).toBe(KIEL.id);

    await waitFor(() => useOfflinePackStore.getState().regions[KIEL.id]?.state === 'ready');

    expect(pack.resume).toHaveBeenCalled();
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.packId).toBe('pack-sealing');
    expect(useOfflinePackStore.getState().regions[KIEL.id]?.cacheBacked).toBeFalsy();
  });

  it('cancel during incomplete seal (index native, UI still cache:*) must not leave Ready', async () => {
    const sealing = mockNativePack('pack-sealing', KIEL.id, incompleteNativeStatus('pack-sealing', 55));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: 'pack-sealing',
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
        },
      }),
    );
    getPacks.mockResolvedValue([sealing]);

    useOfflinePackStore.setState({
      hydrated: true,
      activeDownloadRegionId: KIEL.id,
      regions: {
        ...useOfflinePackStore.getState().regions,
        [KIEL.id]: {
          regionId: KIEL.id,
          state: 'downloading',
          percentage: 90,
          packId: `cache:${KIEL.id}`,
          error: null,
          cacheBacked: true,
        },
      },
    });
    downloadCoordinator.restoreActive(KIEL.id);

    await useOfflinePackStore.getState().cancelDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).not.toBe('ready');
    expect(OfflineManager.deletePack).toHaveBeenCalledWith('pack-sealing');
  });

  it('cancel after durable seal already complete keeps Ready', async () => {
    const sealed = mockNativePack('pack-sealed', KIEL.id, completeNativeStatus('pack-sealed'));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: {
          packId: 'pack-sealed',
          bounds: KIEL.bounds,
          minZoom: KIEL.minZoom,
          maxZoom: KIEL.maxZoom,
        },
      }),
    );
    getPacks.mockResolvedValue([sealed]);

    useOfflinePackStore.setState({
      hydrated: true,
      activeDownloadRegionId: KIEL.id,
      regions: {
        ...useOfflinePackStore.getState().regions,
        [KIEL.id]: {
          regionId: KIEL.id,
          state: 'downloading',
          percentage: 99,
          packId: 'pack-sealed',
          error: null,
        },
      },
    });
    downloadCoordinator.restoreActive(KIEL.id);

    await useOfflinePackStore.getState().cancelDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('ready');
    expect(status?.packId).toBe('pack-sealed');
    expect(OfflineManager.deletePack).not.toHaveBeenCalledWith('pack-sealed');
  });
});
