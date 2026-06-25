import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager, type LngLatBounds, type OfflinePack, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { create } from 'zustand';

import { ensureChartStyleFile } from '../map/chartStyle';
import { getRegionPack, REGION_PACKS } from '../map/regionPacks';
import { t } from '../i18n';
import { clearSeamarkIndex, indexSeamarksForPack } from '../lib/seamarks/seamarkIndex';
import { fetchIsEffectivelyOnline } from '../lib/network/connectivity';

const STORAGE_KEY = 'seacheck.offline.v1';

export type PackDownloadState = 'idle' | 'downloading' | 'ready' | 'error';

export type RegionPackStatus = {
  regionId: string;
  state: PackDownloadState;
  percentage: number;
  packId: string | null;
  error: string | null;
  custom?: boolean;
  displayName?: string;
};

type PersistedIndex = Record<
  string,
  {
    packId: string;
    name?: string;
    custom?: boolean;
    bounds?: LngLatBounds;
    minZoom?: number;
    maxZoom?: number;
    seamarksIndexed?: boolean;
  }
>;

type OfflinePackStore = {
  hydrated: boolean;
  chartStyleUri: string | null;
  regions: Record<string, RegionPackStatus>;
  customBoundsIndex: Record<string, LngLatBounds>;
  hydrate: () => Promise<void>;
  startDownload: (regionId: string) => Promise<void>;
  startCustomDownload: (name: string, bounds: LngLatBounds, minZoom?: number, maxZoom?: number) => Promise<void>;
  deleteRegion: (regionId: string) => Promise<void>;
  hasReadyPack: () => boolean;
};

function emptyStatus(regionId: string): RegionPackStatus {
  return { regionId, state: 'idle', percentage: 0, packId: null, error: null };
}

async function loadIndex(): Promise<PersistedIndex> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PersistedIndex;
  } catch {
    return {};
  }
}

async function saveIndex(index: PersistedIndex) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

/** Map native MapLibre pack status to app download state (exported for tests). */
export function packStateFromNative(native: OfflinePackStatus): PackDownloadState {
  if (native.state === 'complete') return 'ready';
  if (native.state === 'active') return 'downloading';
  if (native.percentage > 0 && native.percentage < 100) return 'downloading';
  return 'idle';
}

function statusFromNative(regionId: string, packId: string, native: OfflinePackStatus): RegionPackStatus {
  return {
    regionId,
    state: packStateFromNative(native),
    percentage: native.percentage,
    packId,
    error: null,
  };
}

export const useOfflinePackStore = create<OfflinePackStore>((set, get) => ({
  hydrated: false,
  chartStyleUri: null,
  customBoundsIndex: {},
  regions: Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)])),

  hydrate: async () => {
    const emptyRegions = Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)]));
    try {
      const chartStyleUri = await ensureChartStyleFile();
      const index = await loadIndex();
      const nativePacks = await OfflineManager.getPacks().catch(() => [] as OfflinePack[]);

      const regions: Record<string, RegionPackStatus> = { ...emptyRegions };

    for (const [regionId, entry] of Object.entries(index)) {
      const native = nativePacks.find((p) => p.id === entry.packId);
      if (!native) {
        delete index[regionId];
        void clearSeamarkIndex(regionId);
        regions[regionId] = {
          ...emptyStatus(regionId),
          custom: entry.custom,
          displayName: entry.name,
          state: 'error',
          error: t('downloads.errorPackMissing'),
        };
        continue;
      }
      try {
        const nativeStatus = await native.status();
        const status = statusFromNative(regionId, native.id, nativeStatus);
        regions[regionId] = {
          ...status,
          custom: entry.custom,
          displayName: entry.name,
        };
      } catch {
        regions[regionId] = { ...emptyStatus(regionId), packId: native.id, state: 'error', error: t('downloads.errorStatusFailed'), custom: entry.custom, displayName: entry.name };
      }
    }

    for (const pack of nativePacks) {
      const regionId = typeof pack.metadata?.regionId === 'string' ? pack.metadata.regionId : null;
      if (!regionId || regions[regionId]?.packId) continue;
      try {
        const status = await pack.status();
        regions[regionId] = statusFromNative(regionId, pack.id, status);
        const meta = pack.metadata ?? {};
        index[regionId] = {
          packId: pack.id,
          name: typeof meta.name === 'string' ? meta.name : index[regionId]?.name,
          custom: Boolean(meta.custom),
          bounds: pack.bounds,
          minZoom: typeof meta.minZoom === 'number' ? meta.minZoom : index[regionId]?.minZoom,
          maxZoom: typeof meta.maxZoom === 'number' ? meta.maxZoom : index[regionId]?.maxZoom,
          seamarksIndexed: index[regionId]?.seamarksIndexed,
        };
      } catch {
        /* ignore orphan packs */
      }
    }

    const customBoundsIndex: Record<string, LngLatBounds> = {};
    for (const [regionId, entry] of Object.entries(index)) {
      if (entry.bounds) customBoundsIndex[regionId] = entry.bounds;
    }

    await saveIndex(index);
    set({ hydrated: true, chartStyleUri, regions, customBoundsIndex });

    if (await fetchIsEffectivelyOnline()) {
      for (const [regionId, entry] of Object.entries(index)) {
        const regionStatus = regions[regionId];
        if (regionStatus?.state !== 'ready' || entry.seamarksIndexed) continue;
        const bounds = entry.bounds ?? getRegionPack(regionId)?.bounds;
        if (!bounds) continue;
        void indexSeamarksForPack(regionId, bounds)
          .then(async () => {
            const latest = await loadIndex();
            if (latest[regionId]) {
              latest[regionId].seamarksIndexed = true;
              await saveIndex(latest);
            }
          })
          .catch(() => {
            /* seamark index is best-effort */
          });
      }
    }
    } catch (error) {
      console.warn('[offlinePackStore] hydrate failed', error);
      set({ hydrated: true, chartStyleUri: null, regions: emptyRegions, customBoundsIndex: {} });
    }
  },

  startDownload: async (regionId) => {
    const packDef = getRegionPack(regionId);
    if (!packDef) return;

    const chartStyleUri = get().chartStyleUri ?? (await ensureChartStyleFile());
    set({ chartStyleUri });

    const existing = get().regions[regionId];
    if (existing?.packId) {
      try {
        await OfflineManager.deletePack(existing.packId);
      } catch {
        /* may already be gone */
      }
    }

    set({
      regions: {
        ...get().regions,
        [regionId]: { regionId, state: 'downloading', percentage: 0, packId: null, error: null },
      },
    });

    try {
      const pack = await OfflineManager.createPack(
        {
          mapStyle: chartStyleUri,
          bounds: packDef.bounds,
          minZoom: packDef.minZoom,
          maxZoom: packDef.maxZoom,
          metadata: { regionId, name: packDef.id },
        },
        (_offlinePack, status) => {
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: statusFromNative(regionId, _offlinePack.id, status),
            },
          }));
        },
        (_offlinePack, error) => {
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: {
                regionId,
                state: 'error',
                percentage: 0,
                packId: _offlinePack.id,
                error: error.message,
              },
            },
          }));
        },
      );

      const index = await loadIndex();
      index[regionId] = { packId: pack.id, seamarksIndexed: false };
      await saveIndex(index);

      const status = await pack.status();
      const finalStatus = statusFromNative(regionId, pack.id, status);
      set((state) => ({
        regions: {
          ...state.regions,
          [regionId]: finalStatus,
        },
      }));

      if (finalStatus.state === 'ready') {
        void indexSeamarksForPack(regionId, packDef.bounds)
          .then(async () => {
            const latest = await loadIndex();
            if (latest[regionId]) {
              latest[regionId].seamarksIndexed = true;
              await saveIndex(latest);
            }
          })
          .catch(() => {
            /* seamark index is best-effort — offline tap still shows chart object */
          });
      }
    } catch (err) {
      const index = await loadIndex();
      delete index[regionId];
      await saveIndex(index);
      const message = err instanceof Error && err.message ? err.message : t('downloads.statusError');
      set({
        regions: {
          ...get().regions,
          [regionId]: { regionId, state: 'error', percentage: 0, packId: null, error: message },
        },
      });
    }
  },

  startCustomDownload: async (name, bounds, minZoom = 10, maxZoom = 14) => {
    const regionId = `custom_${Date.now().toString(36)}`;
    const chartStyleUri = get().chartStyleUri ?? (await ensureChartStyleFile());
    set({ chartStyleUri });

    set({
      regions: {
        ...get().regions,
        [regionId]: { regionId, state: 'downloading', percentage: 0, packId: null, error: null, custom: true, displayName: name },
      },
    });

    try {
      const pack = await OfflineManager.createPack(
        {
          mapStyle: chartStyleUri,
          bounds,
          minZoom,
          maxZoom,
          metadata: { regionId, name, custom: true, minZoom, maxZoom },
        },
        (_offlinePack, status) => {
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: { ...statusFromNative(regionId, _offlinePack.id, status), custom: true, displayName: name },
            },
          }));
        },
        (_offlinePack, error) => {
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: { regionId, state: 'error', percentage: 0, packId: _offlinePack.id, error: error.message, custom: true, displayName: name },
            },
          }));
        },
      );

      const index = await loadIndex();
      index[regionId] = { packId: pack.id, name, custom: true, bounds, minZoom, maxZoom, seamarksIndexed: false };
      await saveIndex(index);

      const status = await pack.status();
      const finalStatus = { ...statusFromNative(regionId, pack.id, status), custom: true, displayName: name };
      set((state) => ({
        customBoundsIndex: { ...state.customBoundsIndex, [regionId]: bounds },
        regions: {
          ...state.regions,
          [regionId]: finalStatus,
        },
      }));

      if (finalStatus.state === 'ready') {
        void indexSeamarksForPack(regionId, bounds)
          .then(async () => {
            const latest = await loadIndex();
            if (latest[regionId]) {
              latest[regionId].seamarksIndexed = true;
              await saveIndex(latest);
            }
          })
          .catch(() => {
            /* best-effort */
          });
      }
    } catch (err) {
      const index = await loadIndex();
      delete index[regionId];
      await saveIndex(index);
      const message = err instanceof Error && err.message ? err.message : t('downloads.statusError');
      set({
        regions: {
          ...get().regions,
          [regionId]: { regionId, state: 'error', percentage: 0, packId: null, error: message, custom: true, displayName: name },
        },
      });
    }
  },

  deleteRegion: async (regionId) => {
    const current = get().regions[regionId];
    if (current?.packId) {
      try {
        await OfflineManager.deletePack(current.packId);
      } catch {
        /* ignore */
      }
    }
    const index = await loadIndex();
    delete index[regionId];
    await saveIndex(index);
    await clearSeamarkIndex(regionId);
    const nextCustom = { ...get().customBoundsIndex };
    delete nextCustom[regionId];
    set({
      customBoundsIndex: nextCustom,
      regions: {
        ...get().regions,
        ...(get().regions[regionId] ? { [regionId]: emptyStatus(regionId) } : {}),
      },
    });
  },

  hasReadyPack: () => Object.values(get().regions).some((r) => r.state === 'ready'),
}));
