import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import { REGION_PACKS } from '../src/map/regionPacks';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
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

jest.mock('../src/lib/offline/downloadStallWatchdog', () => ({
  startDownloadStallWatchdog: jest.fn(() => () => {}),
}));

jest.mock('../src/lib/offline/warmupOfflineEngine', () => ({
  warmupOfflineEngine: jest.fn(async () => {}),
}));

jest.mock('../src/lib/offline/offlineMapEngineHost', () => ({
  ...jest.requireActual('../src/lib/offline/offlineMapEngineHost'),
  waitForOfflineMapEngineStyle: jest.fn(async () => true),
  requestOfflineMapEngineStyleReload: jest.fn(),
}));

const KIEL = REGION_PACKS[0]!;

describe('offlinePackStore.startDownload', () => {
  const createPack = OfflineManager.createPack as jest.Mock;

  beforeEach(async () => {
    resetSeamarkIndexQueueForTests();
    resetOfflinePackStoreForTests();
    await AsyncStorage.clear();
    createPack.mockReset();
    await useOfflinePackStore.getState().hydrate();
  });

  afterEach(async () => {
    downloadCoordinator.invalidate(KIEL.id);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('polls native status when requiredResourceCount stays at zero initially', async () => {
    let pollCount = 0;
    createPack.mockImplementation(async () => {
      const pack = {
        id: 'pack-kiel-slow',
        metadata: { regionId: KIEL.id },
        bounds: KIEL.bounds,
        status: async () => {
          pollCount += 1;
          if (pollCount < 3) {
            return {
              id: 'pack-kiel-slow',
              state: 'inactive',
              percentage: 0,
              completedResourceCount: 0,
              completedResourceSize: 0,
              completedTileCount: 0,
              completedTileSize: 0,
              requiredResourceCount: 0,
            };
          }
          return {
            id: 'pack-kiel-slow',
            state: 'active',
            percentage: 5,
            completedResourceCount: 1,
            completedResourceSize: 100,
            completedTileCount: 1,
            completedTileSize: 80,
            requiredResourceCount: 50,
          };
        },
        resume: jest.fn(async () => {}),
      };
      return pack;
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    await new Promise((resolve) => setTimeout(resolve, 9_000));

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('downloading');
    expect(status?.percentage).toBeGreaterThanOrEqual(0);
    expect(pollCount).toBeGreaterThanOrEqual(3);
  }, 15_000);

  it('keeps downloading state when native reports inactive 0% after createPack', async () => {
    createPack.mockImplementation(async () => {
      const pack = {
        id: 'pack-kiel-new',
        metadata: { regionId: KIEL.id },
        bounds: KIEL.bounds,
        status: async () => ({
          id: 'pack-kiel-new',
          state: 'inactive',
          percentage: 0,
          completedResourceCount: 0,
          completedResourceSize: 0,
          completedTileCount: 0,
          completedTileSize: 0,
          requiredResourceCount: 0,
        }),
        resume: jest.fn(async () => {}),
      };
      return pack;
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('downloading');
    expect(status?.packId).toBe('pack-kiel-new');
    expect(downloadCoordinator.getActiveRegionId()).toBe(KIEL.id);
  }, 20_000);

  it('ignores null native progress callbacks without crashing', async () => {
    createPack.mockImplementation(
      async (
        _opts: unknown,
        onProgress: (pack: { id: string; status: () => Promise<unknown> }, status: unknown) => void,
      ) => {
        const pack = {
          id: 'pack-kiel-null-progress',
          metadata: { regionId: KIEL.id },
          bounds: KIEL.bounds,
          status: async () => null,
          resume: jest.fn(async () => {}),
        };
        onProgress(pack, null);
        return pack;
      },
    );

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('downloading');
    expect(status?.packId).toBe('pack-kiel-null-progress');
    expect(status?.downloadInitializing).toBe(true);
    expect(status?.error).toBeNull();
  }, 20_000);

  it('survives null pack.status() during kickstart polling', async () => {
    createPack.mockImplementation(async () => {
      const pack = {
        id: 'pack-kiel-null-status',
        metadata: { regionId: KIEL.id },
        bounds: KIEL.bounds,
        status: async () => null,
        resume: jest.fn(async () => {}),
      };
      return pack;
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('downloading');
    expect(status?.packId).toBe('pack-kiel-null-status');
    expect(status?.error).toBeNull();
  }, 15_000);
});
