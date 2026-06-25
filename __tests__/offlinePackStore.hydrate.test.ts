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

const STORAGE_KEY = 'seacheck.offline.v1';
const KIEL = REGION_PACKS[0]!;

function mockNativePack(
  id: string,
  regionId: string,
  status: { state: string; percentage: number },
  metadata: Record<string, unknown> = {},
) {
  return {
    id,
    metadata: { regionId, ...metadata },
    bounds: KIEL.bounds,
    status: async () => ({
      id,
      state: status.state,
      percentage: status.percentage,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    }),
    resume: jest.fn(async () => {}),
  };
}

describe('offlinePackStore.hydrate', () => {
  const getPacks = OfflineManager.getPacks as jest.Mock;
  const addListener = OfflineManager.addListener as jest.Mock;

  beforeEach(async () => {
    resetSeamarkIndexQueueForTests();
    resetOfflinePackStoreForTests();
    await AsyncStorage.clear();
    getPacks.mockReset();
    addListener.mockReset();
    addListener.mockResolvedValue(undefined);
  });

  it('hydrates empty index with idle region packs', async () => {
    getPacks.mockResolvedValue([]);

    await useOfflinePackStore.getState().hydrate();

    const state = useOfflinePackStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.chartStyleUri).toBe('file:///mock/map/chart-style.json');
    expect(state.regions[KIEL.id]?.state).toBe('idle');
    expect(state.hasReadyPack()).toBe(false);
  });

  it('reconciles persisted ready pack with native cache', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: { packId: 'pack-kiel', seamarksIndexed: true },
      }),
    );
    getPacks.mockResolvedValue([mockNativePack('pack-kiel', KIEL.id, { state: 'complete', percentage: 100 })]);

    await useOfflinePackStore.getState().hydrate();

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('ready');
    expect(status?.packId).toBe('pack-kiel');
    expect(status?.seamarksIndexed).toBe(true);
    expect(useOfflinePackStore.getState().hasReadyPack()).toBe(true);
  });

  it('marks pack missing when native cache is gone', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: { packId: 'pack-gone' },
      }),
    );
    getPacks.mockResolvedValue([]);

    await useOfflinePackStore.getState().hydrate();

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('error');
    expect(status?.error).toMatch(/missing/i);
    const index = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}') as Record<string, unknown>;
    expect(index[KIEL.id]).toBeUndefined();
  });

  it('keeps pack in error when native listing is temporarily unavailable', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: { packId: 'pack-kiel' },
      }),
    );
    getPacks.mockRejectedValue(new Error('native unavailable'));

    await useOfflinePackStore.getState().hydrate();

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('error');
    expect(status?.error).toMatch(/verify/i);
    const index = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}') as Record<string, unknown>;
    expect(index[KIEL.id]).toBeDefined();
  });

  it('reattaches in-progress download and locks coordinator', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [KIEL.id]: { packId: 'pack-partial', bounds: KIEL.bounds },
      }),
    );
    getPacks.mockResolvedValue([mockNativePack('pack-partial', KIEL.id, { state: 'active', percentage: 42 })]);

    await useOfflinePackStore.getState().hydrate();
    await new Promise((resolve) => setImmediate(resolve));

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('downloading');
    expect(status?.percentage).toBe(42);
    expect(useOfflinePackStore.getState().activeDownloadRegionId).toBe(KIEL.id);
    expect(downloadCoordinator.getActiveRegionId()).toBe(KIEL.id);
    expect(addListener).toHaveBeenCalledWith('pack-partial', expect.any(Function), expect.any(Function));
  });
});
