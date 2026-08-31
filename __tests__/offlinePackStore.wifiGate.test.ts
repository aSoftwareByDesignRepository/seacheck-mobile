import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { REGION_PACKS } from '../src/map/regionPacks';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { resetSeamarkIndexQueueForTests } from '../src/lib/seamarks/seamarkIndexQueue';
import { resetDownloadMapHostForTests } from '../src/lib/offline/downloadMapHost';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';
import { requestConfirm } from '../src/store/confirmStore';
import { useSettingsStore } from '../src/store/settingsStore';

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

jest.mock('../src/store/confirmStore', () => ({
  requestConfirm: jest.fn(),
}));

const KIEL = REGION_PACKS[0]!;

describe('offlinePackStore Wi‑Fi policy at store boundary', () => {
  const fetchNet = NetInfo.fetch as jest.Mock;
  const confirm = requestConfirm as jest.Mock;

  beforeEach(async () => {
    resetSeamarkIndexQueueForTests();
    resetDownloadMapHostForTests();
    resetOfflinePackStoreForTests();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('seacheck.chart.basemapId', 'openseamap-osm-v1');
    useSettingsStore.setState({ downloadWifiOnly: true });
    fetchNet.mockResolvedValue({ isConnected: true, type: 'cellular', isInternetReachable: true });
    confirm.mockResolvedValue(false);
  });

  afterEach(() => {
    downloadCoordinator.invalidate(KIEL.id);
  });

  it('startDownload refuses on cellular when user cancels (no silent data burn)', async () => {
    await expect(useOfflinePackStore.getState().startDownload(KIEL.id)).rejects.toThrow();
    expect(confirm).toHaveBeenCalled();
    const region = useOfflinePackStore.getState().regions[KIEL.id];
    expect(region?.state).not.toBe('downloading');
  });
});
