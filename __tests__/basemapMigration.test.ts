import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import {
  applyBasemapMigrationIfNeeded,
  resetBasemapMigrationForTests,
} from '../src/lib/offline/basemapMigration';
import { CHART_BASEMAP_ID } from '../src/lib/settings/chartBaseStyle';
import { isRedownloadPlaceholderPackId } from '../src/lib/offline/tileCacheDownload';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@maplibre/maplibre-react-native', () => ({
  OfflineManager: {
    clearAmbientCache: jest.fn(async () => undefined),
    deletePack: jest.fn(async () => undefined),
    getPacks: jest.fn(async () => []),
  },
}));

jest.mock('../src/lib/seamarks/seamarkIndex', () => ({
  clearSeamarkIndex: jest.fn(async () => undefined),
}));

describe('applyBasemapMigrationIfNeeded', () => {
  beforeEach(async () => {
    await resetBasemapMigrationForTests();
    jest.clearAllMocks();
  });

  it('is a no-op when basemap id already matches', async () => {
    await AsyncStorage.setItem('seacheck.chart.basemapId', CHART_BASEMAP_ID);
    const index = {
      'kiel-bay': { packId: 'native-1' },
    };
    const result = await applyBasemapMigrationIfNeeded(index);
    expect(result.migrated).toBe(false);
    expect(result.index).toBe(index);
    expect(OfflineManager.clearAmbientCache).not.toHaveBeenCalled();
  });

  it('stamps basemap id on fresh install without a migration notice', async () => {
    const result = await applyBasemapMigrationIfNeeded({});
    expect(result.migrated).toBe(false);
    expect(result.showNotice).toBe(false);
    expect(OfflineManager.clearAmbientCache).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('seacheck.chart.basemapId')).toBe(CHART_BASEMAP_ID);
  });

  it('clears packs and keeps custom bounds for re-download', async () => {
    const index = {
      'kiel-bay': { packId: 'native-corridor' },
      'custom-1': {
        packId: 'native-custom',
        custom: true as const,
        name: 'My bay',
        bounds: [10, 54, 11, 55] as [number, number, number, number],
        minZoom: 10,
        maxZoom: 14,
      },
    };

    const result = await applyBasemapMigrationIfNeeded(index);

    expect(result.migrated).toBe(true);
    expect(result.showNotice).toBe(true);
    expect(OfflineManager.clearAmbientCache).toHaveBeenCalled();
    expect(OfflineManager.deletePack).toHaveBeenCalledWith('native-corridor');
    expect(OfflineManager.deletePack).toHaveBeenCalledWith('native-custom');
    expect(result.index['kiel-bay']).toBeUndefined();
    expect(result.index['custom-1']?.custom).toBe(true);
    expect(result.index['custom-1']?.name).toBe('My bay');
    expect(result.index['custom-1']?.bounds).toEqual([10, 54, 11, 55]);
    expect(isRedownloadPlaceholderPackId(result.index['custom-1']?.packId)).toBe(true);
    expect(await AsyncStorage.getItem('seacheck.chart.basemapId')).toBe(CHART_BASEMAP_ID);
  });
});
