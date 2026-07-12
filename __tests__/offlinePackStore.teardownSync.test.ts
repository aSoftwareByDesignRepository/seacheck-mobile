import AsyncStorage from '@react-native-async-storage/async-storage';

import { REGION_PACKS } from '../src/map/regionPacks';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import * as downloadMapConstants from '../src/lib/offline/downloadMapConstants';
import { resetSeamarkIndexQueueForTests } from '../src/lib/seamarks/seamarkIndexQueue';
import {
  registerDownloadMapController,
  resetDownloadMapHostForTests,
} from '../src/lib/offline/downloadMapHost';
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function markDownloadMapReady() {
  const { markDownloadMapStyleLoaded } = require('../src/lib/offline/downloadMapHost') as {
    markDownloadMapStyleLoaded: (uri: string) => void;
  };
  markDownloadMapStyleLoaded('file:///mock/map/chart-style.json');
}

/**
 * Regression tests for the production-timing teardown window (zeroed under Jest by
 * default): the coordinator ends the window on its own timer, and the store must
 * mirror that — otherwise the app stays stuck on the "saving charts" banner and the
 * map remains replaced by the download placeholder forever.
 */
describe('offlinePackStore coordinator teardown sync (production timing)', () => {
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
    jest.restoreAllMocks();
  });

  it('mirrors coordinator lock and teardown-window expiry into the store', async () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin(KIEL.id);
    expect(useOfflinePackStore.getState().activeDownloadRegionId).toBe(KIEL.id);

    downloadCoordinator.beginMapTeardown(KIEL.id);
    expect(useOfflinePackStore.getState().activeDownloadRegionId).toBeNull();
    expect(useOfflinePackStore.getState().downloadMapTeardownRegionId).toBe(KIEL.id);

    await sleep(120);

    expect(downloadCoordinator.getTeardownRegionId()).toBeNull();
    expect(useOfflinePackStore.getState().downloadMapTeardownRegionId).toBeNull();
  });

  it('clears the teardown region after a successful download completes', async () => {
    jest.spyOn(downloadMapConstants, 'downloadMapLingerMs').mockReturnValue(30);
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(60);

    markDownloadMapReady();
    registerDownloadMapController({
      fitBounds: jest.fn(async () => {}),
      waitForFrame: jest.fn(async () => {}),
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    const state = useOfflinePackStore.getState();
    expect(state.regions[KIEL.id]?.state).toBe('ready');
    expect(state.regions[KIEL.id]?.percentage).toBe(100);
    expect(state.activeDownloadRegionId).toBeNull();
    expect(state.downloadMapTeardownRegionId).toBeNull();
    expect(downloadCoordinator.hasExclusiveMapSession()).toBe(false);
  });

  it('clears the teardown region after a failed download session', async () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    markDownloadMapReady();
    registerDownloadMapController({
      fitBounds: jest.fn(async () => {
        throw new Error('gl surface lost');
      }),
      waitForFrame: jest.fn(async () => {}),
    });

    await useOfflinePackStore.getState().startDownload(KIEL.id);

    expect(useOfflinePackStore.getState().regions[KIEL.id]?.state).toBe('error');

    await sleep(120);

    expect(downloadCoordinator.hasExclusiveMapSession()).toBe(false);
    expect(useOfflinePackStore.getState().activeDownloadRegionId).toBeNull();
    expect(useOfflinePackStore.getState().downloadMapTeardownRegionId).toBeNull();
  });
});
