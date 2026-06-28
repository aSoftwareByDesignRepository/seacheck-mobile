import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager, type LngLatBounds, type OfflinePack, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { create } from 'zustand';

import { ensureChartStyleFile } from '../map/chartStyle';
import { getRegionPack, REGION_PACKS } from '../map/regionPacks';
import { isLegacyRegionPackId } from '../map/legacyRegionPacks';
import { validateRegionPack } from '../map/regionPackValidation';
import { estimateDownloadKb, estimateTileCount } from '../map/tileMath';
import { t } from '../i18n';
import { clearSeamarkIndex, indexSeamarksForPack } from '../lib/seamarks/seamarkIndex';
import {
  cancelSeamarkIndex,
  drainSeamarkIndexQueue,
  enqueueSeamarkIndex,
  ensureSeamarkIndexQueueListening,
  registerSeamarkIndexExecutor,
} from '../lib/seamarks/seamarkIndexQueue';
import { fetchIsEffectivelyOnline } from '../lib/network/connectivity';
import {
  downloadCoordinator,
  formatDownloadError,
  loadNativePacksWithRetry,
  resetDownloadCoordinatorForTests,
} from '../lib/offline/downloadCoordinator';
import { ensureStorageForDownload } from '../lib/offline/storageCheck';
import { useSettingsStore } from './settingsStore';

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
  seamarksIndexed?: boolean;
  seamarksIndexing?: boolean;
  /** Retired macro-region — delete-only in Downloads UI. */
  legacy?: boolean;
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
  activeDownloadRegionId: string | null;
  hydrate: () => Promise<void>;
  startDownload: (regionId: string) => Promise<void>;
  startCustomDownload: (name: string, bounds: LngLatBounds, minZoom?: number, maxZoom?: number, existingRegionId?: string) => Promise<void>;
  retryDownload: (regionId: string) => Promise<void>;
  cancelDownload: (regionId: string) => Promise<void>;
  deleteRegion: (regionId: string) => Promise<void>;
  hasReadyPack: () => boolean;
  retryPendingSeamarkIndexing: () => Promise<void>;
  ensureChartStyle: () => Promise<string>;
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
  if (native.percentage >= 100) return 'ready';
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

function syncActiveDownloadId() {
  return { activeDownloadRegionId: downloadCoordinator.getActiveRegionId() };
}

async function removeNativePack(packId: string | null | undefined) {
  if (!packId) return;
  try {
    await OfflineManager.deletePack(packId);
  } catch {
    /* may already be gone */
  }
}

async function runSeamarkIndexing(
  regionId: string,
  bounds: LngLatBounds,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
) {
  set((state) => {
    const current = state.regions[regionId];
    if (!current || current.seamarksIndexing || current.seamarksIndexed) return state;
    return {
      regions: {
        ...state.regions,
        [regionId]: { ...current, seamarksIndexing: true },
      },
    };
  });

  try {
    await indexSeamarksForPack(regionId, bounds);
    const latest = await loadIndex();
    if (latest[regionId]) {
      latest[regionId].seamarksIndexed = true;
      await saveIndex(latest);
    }
    set((state) => {
      const current = state.regions[regionId];
      if (!current) return state;
      return {
        regions: {
          ...state.regions,
          [regionId]: { ...current, seamarksIndexed: true, seamarksIndexing: false },
        },
      };
    });
  } catch (error) {
    set((state) => {
      const current = state.regions[regionId];
      if (!current) return state;
      return {
        regions: {
          ...state.regions,
          [regionId]: { ...current, seamarksIndexing: false },
        },
      };
    });
    throw error;
  }
}

function scheduleSeamarkIndexing(regionId: string, bounds: LngLatBounds) {
  ensureSeamarkIndexQueueListening();
  enqueueSeamarkIndex(regionId, bounds);
}

function finishDownloadSession(regionId: string, set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void) {
  downloadCoordinator.end(regionId);
  set(syncActiveDownloadId());
}

async function assertStorageForBounds(bounds: LngLatBounds, minZoom: number, maxZoom: number) {
  const estimatedKb = estimateDownloadKb(estimateTileCount(bounds, minZoom, maxZoom));
  const storage = await ensureStorageForDownload(estimatedKb);
  if (!storage.ok && storage.reason === 'insufficient') {
    throw new Error(t('downloads.errorStorageInsufficient'));
  }
}

type DownloadSessionContext = {
  regionId: string;
  session: number;
  previousPackId: string | null;
  previousWasReady: boolean;
  restoreOnFailure?: RegionPackStatus;
  bounds: LngLatBounds;
  customMeta?: { custom: true; displayName: string };
  finalizeExtra?: {
    custom?: boolean;
    displayName?: string;
    name?: string;
    minZoom?: number;
    maxZoom?: number;
    bounds?: LngLatBounds;
  };
};

function createDownloadSession(
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
  get: () => OfflinePackStore,
) {
  let finished = false;

  const markReady = async (packId: string, status: OfflinePackStatus) => {
    if (finished) return;
    if (!isNativeDownloadComplete(status)) return;
    finished = true;
    await finalizeReadyDownload(
      ctx.regionId,
      packId,
      ctx.previousPackId,
      ctx.bounds,
      ctx.finalizeExtra,
    );
    set((state) => ({
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          ...statusFromNative(ctx.regionId, packId, status),
          ...ctx.customMeta,
          seamarksIndexed: false,
          seamarksIndexing: false,
        },
      },
      ...(ctx.finalizeExtra?.bounds
        ? { customBoundsIndex: { ...state.customBoundsIndex, [ctx.regionId]: ctx.finalizeExtra.bounds } }
        : {}),
    }));
    void scheduleSeamarkIndexing(ctx.regionId, ctx.bounds);
    finishDownloadSession(ctx.regionId, set);
  };

  const markFailed = async (packId: string | null, message: string) => {
    if (finished) return;
    finished = true;
    await removeNativePack(packId);

    if (ctx.restoreOnFailure) {
      set((state) => ({
        regions: {
          ...state.regions,
          [ctx.regionId]: { ...ctx.restoreOnFailure!, error: message },
        },
      }));
      finishDownloadSession(ctx.regionId, set);
      return;
    }

    const index = await loadIndex();
    delete index[ctx.regionId];
    await saveIndex(index);
    set((state) => ({
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          regionId: ctx.regionId,
          state: 'error',
          percentage: 0,
          packId: null,
          error: message,
          ...ctx.customMeta,
        },
      },
    }));
    finishDownloadSession(ctx.regionId, set);
  };

  const onProgress = (_offlinePack: OfflinePack, status: OfflinePackStatus) => {
    if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
    set((state) => ({
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          ...statusFromNative(ctx.regionId, _offlinePack.id, status),
          ...ctx.customMeta,
          seamarksIndexed: state.regions[ctx.regionId]?.seamarksIndexed,
          seamarksIndexing: state.regions[ctx.regionId]?.seamarksIndexing,
        },
      },
    }));
    void markReady(_offlinePack.id, status);
  };

  const onError = (_offlinePack: OfflinePack, error: unknown) => {
    if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
    void markFailed(_offlinePack.id, formatDownloadError(error, t('downloads.statusError')));
  };

  return { markReady, markFailed, onProgress, onError };
}

async function reattachDownloadingPack(
  pack: OfflinePack,
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
  get: () => OfflinePackStore,
) {
  if (!downloadCoordinator.restoreActive(ctx.regionId)) return;

  const { markReady, markFailed, onProgress, onError } = createDownloadSession(ctx, set, get);
  try {
    await OfflineManager.addListener(pack.id, onProgress, onError);
    const status = await pack.status();
    set((state) => ({
      ...syncActiveDownloadId(),
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          ...statusFromNative(ctx.regionId, pack.id, status),
          ...ctx.customMeta,
          seamarksIndexed: state.regions[ctx.regionId]?.seamarksIndexed,
          seamarksIndexing: state.regions[ctx.regionId]?.seamarksIndexing,
        },
      },
    }));
    if (packStateFromNative(status) === 'downloading') {
      try {
        await pack.resume();
      } catch {
        /* native may already be active */
      }
    }
    await markReady(pack.id, status);
  } catch (err) {
    await markFailed(pack.id, formatDownloadError(err, t('downloads.statusError')));
  }
}

function isNativeDownloadComplete(status: OfflinePackStatus): boolean {
  return status.state === 'complete' || status.percentage >= 100;
}

/** Some native builds need an explicit resume after createPack before tiles download. */
async function kickstartNativeDownload(pack: OfflinePack): Promise<OfflinePackStatus> {
  let status = await pack.status();
  if (isNativeDownloadComplete(status)) return status;
  try {
    await pack.resume();
  } catch {
    /* native may already be active */
  }
  return pack.status();
}

async function finalizeReadyDownload(
  regionId: string,
  newPackId: string,
  previousPackId: string | null,
  bounds: LngLatBounds,
  extra?: { custom?: boolean; displayName?: string; name?: string; minZoom?: number; maxZoom?: number; bounds?: LngLatBounds },
) {
  const index = await loadIndex();
  index[regionId] = {
    packId: newPackId,
    seamarksIndexed: false,
    name: extra?.name ?? extra?.displayName ?? index[regionId]?.name,
    custom: extra?.custom ?? index[regionId]?.custom,
    bounds: extra?.bounds ?? index[regionId]?.bounds ?? bounds,
    minZoom: extra?.minZoom ?? index[regionId]?.minZoom,
    maxZoom: extra?.maxZoom ?? index[regionId]?.maxZoom,
  };
  await saveIndex(index);

  if (previousPackId && previousPackId !== newPackId) {
    await removeNativePack(previousPackId);
  }
}

export const useOfflinePackStore = create<OfflinePackStore>((set, get) => ({
  hydrated: false,
  chartStyleUri: null,
  customBoundsIndex: {},
  activeDownloadRegionId: null,
  regions: Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)])),

  hydrate: async () => {
    const emptyRegions = Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)]));

    let chartStyleUri: string | null = null;
    try {
      chartStyleUri = await ensureChartStyleFile(useSettingsStore.getState().chartBaseStyle);
    } catch (error) {
      console.warn('[offlinePackStore] chart style unavailable', error);
    }

    try {
      const index = await loadIndex();
      const { packs: nativePacksRaw, ok: nativeOk } = await loadNativePacksWithRetry(() => OfflineManager.getPacks());
      const nativePacks = nativePacksRaw as OfflinePack[];

      const regions: Record<string, RegionPackStatus> = { ...emptyRegions };

      for (const [regionId, entry] of Object.entries(index)) {
        const native = nativePacks.find((p) => p.id === entry.packId);
        if (!native) {
          if (!nativeOk) {
            regions[regionId] = {
              ...emptyStatus(regionId),
              custom: entry.custom,
              displayName: entry.name,
              packId: entry.packId,
              state: 'error',
              error: t('downloads.errorPackUnavailable'),
              legacy: isLegacyRegionPackId(regionId),
            };
            continue;
          }
          delete index[regionId];
          void clearSeamarkIndex(regionId);
          regions[regionId] = {
            ...emptyStatus(regionId),
            custom: entry.custom,
            displayName: entry.name,
            state: 'error',
            error: t('downloads.errorPackMissing'),
            legacy: isLegacyRegionPackId(regionId),
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
            seamarksIndexed: entry.seamarksIndexed ?? false,
            legacy: isLegacyRegionPackId(regionId),
          };
        } catch {
          regions[regionId] = {
            ...emptyStatus(regionId),
            packId: native.id,
            state: 'error',
            error: t('downloads.errorStatusFailed'),
            custom: entry.custom,
            displayName: entry.name,
            legacy: isLegacyRegionPackId(regionId),
          };
        }
      }

      for (const pack of nativePacks) {
        const regionId = typeof pack.metadata?.regionId === 'string' ? pack.metadata.regionId : null;
        if (!regionId || regions[regionId]?.packId) continue;
        try {
          const status = await pack.status();
          const meta = pack.metadata ?? {};
          const legacy = isLegacyRegionPackId(regionId);
          regions[regionId] = {
            ...statusFromNative(regionId, pack.id, status),
            legacy,
            custom: Boolean(meta.custom),
            displayName: typeof meta.name === 'string' ? meta.name : undefined,
          };
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

      let restoredDownloadId: string | null = null;
      for (const [regionId, regionStatus] of Object.entries(regions)) {
        if (regionStatus.state !== 'downloading' || !regionStatus.packId) continue;
        if (restoredDownloadId) {
          console.warn('[offlinePackStore] multiple in-progress downloads; only reattaching first');
          continue;
        }
        const native = nativePacks.find((p) => p.id === regionStatus.packId);
        if (!native) continue;
        const entry = index[regionId];
        const bounds = entry?.bounds ?? getRegionPack(regionId)?.bounds;
        if (!bounds) continue;
        restoredDownloadId = regionId;
        const customMeta = entry?.custom
          ? { custom: true as const, displayName: entry.name ?? regionId }
          : undefined;
        void reattachDownloadingPack(
          native,
          {
            regionId,
            session: downloadCoordinator.sessionToken(regionId) || 1,
            previousPackId: null,
            previousWasReady: false,
            bounds,
            customMeta,
            finalizeExtra: entry?.custom
              ? {
                  name: entry.name,
                  custom: true,
                  displayName: entry.name,
                  bounds: entry.bounds,
                  minZoom: entry.minZoom,
                  maxZoom: entry.maxZoom,
                }
              : undefined,
          },
          set,
          get,
        );
      }

      set({
        hydrated: true,
        chartStyleUri,
        regions,
        customBoundsIndex,
        activeDownloadRegionId: downloadCoordinator.getActiveRegionId(),
      });

      if (await fetchIsEffectivelyOnline()) {
        for (const [regionId, entry] of Object.entries(index)) {
          const regionStatus = regions[regionId];
          if (regionStatus?.state !== 'ready' || entry.seamarksIndexed) continue;
          const bounds = entry.bounds ?? getRegionPack(regionId)?.bounds;
          if (!bounds) continue;
          scheduleSeamarkIndexing(regionId, bounds);
        }
      }
    } catch (error) {
      console.warn('[offlinePackStore] hydrate failed', error);
      const prev = get();
      if (prev.hydrated) {
        set({ hydrated: true });
        return;
      }
      set({ hydrated: true, chartStyleUri, regions: emptyRegions, customBoundsIndex: {}, activeDownloadRegionId: null });
    }
  },

  startDownload: async (regionId) => {
    const packDef = getRegionPack(regionId);
    if (!packDef) {
      throw new Error(t('downloads.downloadFailed'));
    }

    if (isLegacyRegionPackId(regionId)) {
      throw new Error(t('downloads.errorPackRetired'));
    }

    const packValidation = validateRegionPack(packDef);
    if (!packValidation.ok) {
      throw new Error(t('downloads.errorPackTooLarge'));
    }

    await assertStorageForBounds(packDef.bounds, packDef.minZoom, packDef.maxZoom);

    const session = downloadCoordinator.tryBegin(regionId);
    if (session == null) {
      throw new Error(t('downloads.errorDownloadBusy'));
    }

    const previous = get().regions[regionId] ?? emptyStatus(regionId);
    const previousPackId = previous.state === 'ready' ? previous.packId : null;
    const previousWasReady = previous.state === 'ready';

    if (previous.packId && previous.state !== 'ready') {
      await removeNativePack(previous.packId);
    }

    set({
      ...syncActiveDownloadId(),
      regions: {
        ...get().regions,
        [regionId]: { regionId, state: 'downloading', percentage: 0, packId: null, error: null },
      },
    });

    const ctx: DownloadSessionContext = {
      regionId,
      session,
      previousPackId,
      previousWasReady,
      restoreOnFailure: previousWasReady ? previous : undefined,
      bounds: packDef.bounds,
    };
    const { markReady, markFailed, onProgress, onError } = createDownloadSession(ctx, set, get);

    let newPackId: string | null = null;

    try {
      const chartStyleUri = await get().ensureChartStyle();

      const pack = await OfflineManager.createPack(
        {
          mapStyle: chartStyleUri,
          bounds: packDef.bounds,
          minZoom: packDef.minZoom,
          maxZoom: packDef.maxZoom,
          metadata: { regionId, name: packDef.id },
        },
        onProgress,
        onError,
      );

      newPackId = pack.id;
      const status = await kickstartNativeDownload(pack);
      set((state) => ({
        regions: { ...state.regions, [regionId]: statusFromNative(regionId, pack.id, status) },
      }));
      await markReady(pack.id, status);
    } catch (err) {
      await markFailed(newPackId, formatDownloadError(err, t('downloads.statusError')));
      throw err;
    }
  },

  startCustomDownload: async (name, bounds, minZoom = 10, maxZoom = 14, existingRegionId) => {
    const regionId = existingRegionId ?? `custom_${Date.now().toString(36)}`;

    await assertStorageForBounds(bounds, minZoom, maxZoom);

    const session = downloadCoordinator.tryBegin(regionId);
    if (session == null) {
      throw new Error(t('downloads.errorDownloadBusy'));
    }

    const customMeta = { custom: true as const, displayName: name };
    const ctx: DownloadSessionContext = {
      regionId,
      session,
      previousPackId: null,
      previousWasReady: false,
      bounds,
      customMeta,
      finalizeExtra: { name, custom: true, displayName: name, bounds, minZoom, maxZoom },
    };
    const { markReady, markFailed, onProgress, onError } = createDownloadSession(ctx, set, get);

    let newPackId: string | null = null;

    try {
      const chartStyleUri = await get().ensureChartStyle();

      set({
        ...syncActiveDownloadId(),
        regions: {
          ...get().regions,
          [regionId]: { regionId, state: 'downloading', percentage: 0, packId: null, error: null, ...customMeta },
        },
      });

      const pack = await OfflineManager.createPack(
        {
          mapStyle: chartStyleUri,
          bounds,
          minZoom,
          maxZoom,
          metadata: { regionId, name, custom: true, minZoom, maxZoom },
        },
        onProgress,
        onError,
      );

      newPackId = pack.id;
      const status = await kickstartNativeDownload(pack);
      set((state) => ({
        regions: { ...state.regions, [regionId]: { ...statusFromNative(regionId, pack.id, status), ...customMeta } },
      }));
      await markReady(pack.id, status);
    } catch (err) {
      await markFailed(newPackId, formatDownloadError(err, t('downloads.statusError')));
      throw err;
    }
  },

  retryDownload: async (regionId) => {
    const status = get().regions[regionId];
    if (!status) return;

    if (isLegacyRegionPackId(regionId)) {
      throw new Error(t('downloads.errorPackRetired'));
    }

    if (status.custom) {
      const bounds = get().customBoundsIndex[regionId];
      if (!bounds) throw new Error(t('downloads.downloadFailed'));
      const index = await loadIndex();
      const entry = index[regionId];
      const name = status.displayName ?? entry?.name ?? regionId;
      const minZoom = entry?.minZoom ?? 10;
      const maxZoom = entry?.maxZoom ?? 14;
      if (status.packId) await removeNativePack(status.packId);
      await get().startCustomDownload(name, bounds, minZoom, maxZoom, regionId);
      return;
    }

    await get().startDownload(regionId);
  },

  cancelDownload: async (regionId) => {
    const current = get().regions[regionId];
    if (!current || current.state !== 'downloading') return;

    downloadCoordinator.invalidate(regionId);
    await removeNativePack(current.packId);

    const index = await loadIndex();
    const indexedPackId = index[regionId]?.packId;
    const nextCustom = { ...get().customBoundsIndex };

    if (indexedPackId && indexedPackId !== current.packId) {
      try {
        const nativePacks = await OfflineManager.getPacks();
        const native = nativePacks.find((p) => p.id === indexedPackId);
        if (native) {
          const nativeStatus = await native.status();
          set({
            ...syncActiveDownloadId(),
            customBoundsIndex: nextCustom,
            regions: {
              ...get().regions,
              [regionId]: {
                ...statusFromNative(regionId, native.id, nativeStatus),
                custom: current.custom,
                displayName: current.displayName,
              },
            },
          });
          return;
        }
      } catch {
        /* fall through to idle */
      }
    }

    const boundsBeforeDelete = index[regionId]?.bounds ?? nextCustom[regionId];
    delete index[regionId];
    await saveIndex(index);
    if (current.custom) {
      if (boundsBeforeDelete) nextCustom[regionId] = boundsBeforeDelete;
    } else {
      delete nextCustom[regionId];
    }

    set({
      ...syncActiveDownloadId(),
      customBoundsIndex: nextCustom,
      regions: {
        ...get().regions,
        [regionId]: current.custom
          ? { ...emptyStatus(regionId), custom: true, displayName: current.displayName }
          : emptyStatus(regionId),
      },
    });
  },

  deleteRegion: async (regionId) => {
    const current = get().regions[regionId];
    if (current?.state === 'downloading') {
      await get().cancelDownload(regionId);
      return;
    }

    cancelSeamarkIndex(regionId);
    downloadCoordinator.invalidate(regionId);
    await removeNativePack(current?.packId);

    const index = await loadIndex();
    delete index[regionId];
    await saveIndex(index);
    await clearSeamarkIndex(regionId);

    const nextCustom = { ...get().customBoundsIndex };
    delete nextCustom[regionId];

    set({
      ...syncActiveDownloadId(),
      customBoundsIndex: nextCustom,
      regions: {
        ...get().regions,
        ...(get().regions[regionId]
          ? {
              [regionId]: current?.custom
                ? { ...emptyStatus(regionId), custom: true, displayName: current.displayName }
                : emptyStatus(regionId),
            }
          : {}),
      },
    });
  },

  hasReadyPack: () => Object.values(get().regions).some((r) => r.state === 'ready'),

  ensureChartStyle: async () => {
    const uri = await ensureChartStyleFile(useSettingsStore.getState().chartBaseStyle);
    set({ chartStyleUri: uri });
    return uri;
  },

  retryPendingSeamarkIndexing: async () => {
    if (!(await fetchIsEffectivelyOnline())) return;
    const index = await loadIndex();
    const { regions } = get();
    for (const [regionId, entry] of Object.entries(index)) {
      const regionStatus = regions[regionId];
      if (regionStatus?.state !== 'ready' || entry.seamarksIndexed || regionStatus.seamarksIndexing) continue;
      const bounds = entry.bounds ?? getRegionPack(regionId)?.bounds;
      if (!bounds) continue;
      scheduleSeamarkIndexing(regionId, bounds);
    }
    await drainSeamarkIndexQueue();
  },
}));

registerSeamarkIndexExecutor(async (regionId, bounds) => {
  await runSeamarkIndexing(regionId, bounds, useOfflinePackStore.setState);
});

/** Test-only store reset. */
export function resetOfflinePackStoreForTests(): void {
  resetDownloadCoordinatorForTests();
  useOfflinePackStore.setState({
    hydrated: false,
    chartStyleUri: null,
    customBoundsIndex: {},
    activeDownloadRegionId: null,
    regions: Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)])),
  });
}
