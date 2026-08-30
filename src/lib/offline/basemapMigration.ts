import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import { CHART_BASEMAP_ID } from '../settings/chartBaseStyle';
import { clearSeamarkIndex } from '../seamarks/seamarkIndex';
import {
  isNativeOfflinePackId,
  redownloadPlaceholderPackId,
} from './tileCacheDownload';
import type { PersistedIndex } from './offlinePackIndex';

const BASEMAP_ID_KEY = 'seacheck.chart.basemapId';
const BASEMAP_NOTICE_KEY = 'seacheck.chart.basemapMigrationNotice';

export type BasemapMigrationResult = {
  /** True when packs/cache were cleared because the basemap URL set changed. */
  migrated: boolean;
  /** User-facing one-shot notice until dismissed. */
  showNotice: boolean;
  /** Index after migration (caller should persist). */
  index: PersistedIndex;
};

async function clearAmbientChartCache(): Promise<void> {
  const clear = OfflineManager.clearAmbientCache;
  if (typeof clear !== 'function') return;
  try {
    await clear.call(OfflineManager);
  } catch (error) {
    console.warn('[basemapMigration] clearAmbientCache failed', error);
  }
}

async function deleteIndexedNativePacks(index: PersistedIndex): Promise<void> {
  for (const entry of Object.values(index)) {
    if (!isNativeOfflinePackId(entry.packId)) continue;
    try {
      await OfflineManager.deletePack(entry.packId);
    } catch {
      /* pack may already be gone */
    }
  }

  try {
    const nativePacks = await OfflineManager.getPacks();
    for (const pack of nativePacks) {
      const regionId = typeof pack.metadata?.regionId === 'string' ? pack.metadata.regionId : null;
      if (regionId && index[regionId]) {
        try {
          await OfflineManager.deletePack(pack.id);
        } catch {
          /* best effort */
        }
      }
    }
  } catch (error) {
    console.warn('[basemapMigration] listing native packs failed', error);
  }
}

/**
 * When the chart basemap identity changes (e.g. CARTO → OpenSeaMap OSM), cached
 * tiles for the old tile URLs are useless. Clear ambient + offline packs while
 * preserving custom region names/bounds so users can re-download in one tap.
 */
export async function applyBasemapMigrationIfNeeded(index: PersistedIndex): Promise<BasemapMigrationResult> {
  const storedId = await AsyncStorage.getItem(BASEMAP_ID_KEY);
  const noticePending = (await AsyncStorage.getItem(BASEMAP_NOTICE_KEY)) === '1';

  if (storedId === CHART_BASEMAP_ID) {
    return { migrated: false, showNotice: noticePending, index };
  }

  // Fresh install: stamp the current basemap id without a user-facing migration notice.
  if (storedId == null && Object.keys(index).length === 0) {
    await AsyncStorage.setItem(BASEMAP_ID_KEY, CHART_BASEMAP_ID);
    return { migrated: false, showNotice: false, index };
  }

  const previousId = storedId ?? 'carto-voyager';
  console.info(`[basemapMigration] ${previousId} → ${CHART_BASEMAP_ID}`);

  await clearAmbientChartCache();
  await deleteIndexedNativePacks(index);

  const nextIndex: PersistedIndex = {};
  for (const [regionId, entry] of Object.entries(index)) {
    void clearSeamarkIndex(regionId);
    if (entry.custom && entry.bounds) {
      nextIndex[regionId] = {
        packId: redownloadPlaceholderPackId(regionId),
        name: entry.name,
        custom: true,
        bounds: entry.bounds,
        minZoom: entry.minZoom,
        maxZoom: entry.maxZoom,
      };
    }
  }

  await AsyncStorage.setItem(BASEMAP_ID_KEY, CHART_BASEMAP_ID);
  await AsyncStorage.setItem(BASEMAP_NOTICE_KEY, '1');

  return { migrated: true, showNotice: true, index: nextIndex };
}

export async function dismissBasemapMigrationNotice(): Promise<void> {
  await AsyncStorage.removeItem(BASEMAP_NOTICE_KEY);
}

export async function peekBasemapMigrationNotice(): Promise<boolean> {
  return (await AsyncStorage.getItem(BASEMAP_NOTICE_KEY)) === '1';
}

/** Test-only. */
export async function resetBasemapMigrationForTests(): Promise<void> {
  await AsyncStorage.removeItem(BASEMAP_ID_KEY);
  await AsyncStorage.removeItem(BASEMAP_NOTICE_KEY);
}
