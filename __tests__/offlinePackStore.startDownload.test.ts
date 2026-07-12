import AsyncStorage from '@react-native-async-storage/async-storage';

import { REGION_PACKS } from '../src/map/regionPacks';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { resetSeamarkIndexQueueForTests } from '../src/lib/seamarks/seamarkIndexQueue';
import { resetDownloadMapHostForTests, registerDownloadMapController } from '../src/lib/offline/downloadMapHost';
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

const KIEL = REGION_PACKS[0]!;

describe('offlinePackStore.startDownload (cache sweep)', () => {
  jest.setTimeout(15_000);

  beforeEach(async () => {
    resetSeamarkIndexQueueForTests();
    resetDownloadMapHostForTests();
    resetOfflinePackStoreForTests();
    await AsyncStorage.clear();
    await useOfflinePackStore.getState().hydrate();
  });

  afterEach(() => {
    downloadCoordinator.invalidate(KIEL.id);
  });

  it('marks a region ready after tile cache sweep completes', async () => {
    const { markDownloadMapStyleLoaded } = require('../src/lib/offline/downloadMapHost') as {
      markDownloadMapStyleLoaded: (uri: string) => void;
    };
    markDownloadMapStyleLoaded('file:///mock/map/chart-style.json');
    registerDownloadMapController({
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const status = useOfflinePackStore.getState().regions[KIEL.id];
    expect(status?.state).toBe('ready');
    expect(status?.cacheBacked).toBe(true);
    expect(status?.percentage).toBe(100);
    expect(status?.packId).toBe(`cache:${KIEL.id}`);
  });
});
