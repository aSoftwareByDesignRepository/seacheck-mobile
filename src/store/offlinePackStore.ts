import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OfflineManager,
  type LngLatBounds,
  type OfflinePack,
  type OfflinePackCreateOptions,
  type OfflinePackStatus,
} from '@maplibre/maplibre-react-native';
import { create } from 'zustand';

import { ensureChartStyleFile } from '../map/chartStyle';
import { getRegionPack, REGION_PACKS } from '../map/regionPacks';
import { isLegacyRegionPackId } from '../map/legacyRegionPacks';
import { validateRegionPack } from '../map/regionPackValidation';
import { estimateDownloadKb, estimateTileCount } from '../map/tileMath';
import { boundsCenter, validateDownloadBounds } from '../lib/map/bounds';
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
import { promiseWithTimeout } from '../lib/async/promiseWithTimeout';
import { assertChartDownloadNetworkReady } from '../lib/network/downloadNetwork';
import { resolveChartTileProbeCenter } from '../lib/network/chartTileProbeCenter';
import { ensureMapLibreNetworkForDownload } from '../lib/network/mapLibreNetworkGate';
import {
  downloadCoordinator,
  formatDownloadError,
  loadNativePacksWithRetry,
  resetDownloadCoordinatorForTests,
} from '../lib/offline/downloadCoordinator';
import { startDownloadStallWatchdog, type StallDiagnostics } from '../lib/offline/downloadStallWatchdog';
import { recreateOfflinePack } from '../lib/offline/nativePackRecovery';
import { rememberDownloadFailureDiagnostics } from '../lib/offline/downloadFailureDiagnostics';
import { isNativeDownloadKickstarted, isNativePackInitializing } from '../lib/offline/nativePackProgress';
import { initializingNativePackStatus, pollNativePackStatus, readNativePackStatus, resolveNativePackStatus } from '../lib/offline/nativePackStatus';
import {
  ensureOfflineMapEnginePrimedBeforeDownload,
  isOfflineMapEngineStyleLoaded,
} from '../lib/offline/offlineMapEngineHost';
import { yieldToUi } from '../lib/async/yieldToUi';
import { resetOfflineManagerSetupForTests } from '../lib/offline/offlineManagerSetup';
import { resetOfflineMapEngineHostForTests } from '../lib/offline/offlineMapEngineHost';
import { warmupOfflineEngine } from '../lib/offline/warmupOfflineEngine';
import { ensureStorageForDownload } from '../lib/offline/storageCheck';
import { sanitizePersistedIndex, type PersistedIndex } from '../lib/offline/offlinePackIndex';

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
  /** Native tile enumeration not finished (requiredResourceCount ≤ 1, no bytes yet). */
  downloadInitializing?: boolean;
};

type OfflinePackStore = {
  hydrated: boolean;
  chartStyleUri: string | null;
  regions: Record<string, RegionPackStatus>;
  customBoundsIndex: Record<string, LngLatBounds>;
  activeDownloadRegionId: string | null;
  hydrate: () => Promise<void>;
  /** Unblocks map UI when boot hydrate was abandoned by timeout but native work may still finish later. */
  ensureHydratedForUi: () => Promise<void>;
  startDownload: (regionId: string) => Promise<void>;
  startCustomDownload: (name: string, bounds: LngLatBounds, minZoom?: number, maxZoom?: number, existingRegionId?: string) => Promise<void>;
  retryDownload: (regionId: string) => Promise<void>;
  cancelDownload: (regionId: string) => Promise<void>;
  deleteRegion: (regionId: string) => Promise<void>;
  hasReadyPack: () => boolean;
  retryPendingSeamarkIndexing: () => Promise<void>;
  ensureChartStyle: () => Promise<string>;
  /** Reserve download slot before async preflight — keeps MapLibre network on during warmup. */
  preflightDownloadLock: (regionId: string) => boolean;
  releasePreflightDownloadLock: (regionId: string) => void;
  /** Persist preflight failure so Downloads UI shows error state and retry. */
  markPreflightDownloadFailed: (regionId: string, message: string) => void;
  /** Clear a prior preflight error when the user starts a new attempt. */
  resetDownloadErrorForRetry: (regionId: string) => void;
};

const NATIVE_STATUS_TIMEOUT_MS = 4_000;
const BOOT_NATIVE_PACK_ATTEMPTS = 2;
const BOOT_NATIVE_PACK_TIMEOUT_MS = 5_000;

async function readHydrateNativePackStatus(pack: OfflinePack): Promise<OfflinePackStatus | null> {
  return readNativePackStatus(pack, NATIVE_STATUS_TIMEOUT_MS);
}

function emptyStatus(regionId: string): RegionPackStatus {
  return { regionId, state: 'idle', percentage: 0, packId: null, error: null };
}

async function loadIndex(): Promise<PersistedIndex> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const sanitized = sanitizePersistedIndex(JSON.parse(raw) as unknown);
    const reserialized = JSON.stringify(sanitized);
    if (reserialized !== raw) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, reserialized);
      } catch {
        /* best effort — do not block hydrate on index cleanup */
      }
    }
    return sanitized;
  } catch {
    return {};
  }
}

async function saveIndex(index: PersistedIndex) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

/** Whether native pack status indicates a fully cached, usable offline region. */
export function isNativeDownloadComplete(status: OfflinePackStatus | null | undefined): boolean {
  if (!status) return false;
  const nominallyComplete = status.state === 'complete' || status.percentage >= 100;
  if (!nominallyComplete) return false;
  if (status.requiredResourceCount <= 0) return false;
  return status.completedResourceCount >= status.requiredResourceCount;
}

/** Map native MapLibre pack status to app download state (exported for tests). */
export function packStateFromNative(native: OfflinePackStatus | null | undefined): PackDownloadState {
  if (!native) return 'idle';
  if (isNativeDownloadComplete(native)) return 'ready';
  if (native.state === 'active') return 'downloading';
  if (native.percentage > 0 && native.percentage < 100) return 'downloading';
  if (
    native.requiredResourceCount > 0 &&
    native.completedResourceCount < native.requiredResourceCount
  ) {
    return 'downloading';
  }
  return 'idle';
}

type NativeStatusOptions = {
  /** Keep downloading UI while coordinator holds this region (native often reports inactive/0% before first tick). */
  sessionActive?: boolean;
  current?: RegionPackStatus;
};

function resolvePackState(
  regionId: string,
  native: OfflinePackStatus | null | undefined,
  options?: NativeStatusOptions,
): PackDownloadState {
  const fromNative = packStateFromNative(native);
  if (fromNative !== 'idle') return fromNative;
  if (!native) {
    const sessionActive =
      options?.sessionActive ??
      (downloadCoordinator.getActiveRegionId() === regionId);
    if (sessionActive) return 'downloading';
    if (options?.current?.state === 'downloading') return 'downloading';
    return 'idle';
  }
  const sessionActive =
    options?.sessionActive ??
    (downloadCoordinator.getActiveRegionId() === regionId);
  if (sessionActive && !isNativeDownloadComplete(native)) {
    return 'downloading';
  }
  if (options?.current?.state === 'downloading' && !isNativeDownloadComplete(native)) {
    return 'downloading';
  }
  return 'idle';
}

function statusFromNative(
  regionId: string,
  packId: string,
  native: OfflinePackStatus | null | undefined,
  options?: NativeStatusOptions,
): RegionPackStatus {
  const resolved = native ?? initializingNativePackStatus(packId);
  return {
    regionId,
    state: resolvePackState(regionId, native, options),
    percentage: resolved.percentage,
    packId,
    error: null,
    downloadInitializing: native ? isNativePackInitializing(native) : true,
  };
}

function syncActiveDownloadId() {
  return { activeDownloadRegionId: downloadCoordinator.getActiveRegionId() };
}

function buildCustomBoundsIndex(index: PersistedIndex): Record<string, LngLatBounds> {
  const customBoundsIndex: Record<string, LngLatBounds> = {};
  for (const [regionId, entry] of Object.entries(index)) {
    if (entry.bounds) customBoundsIndex[regionId] = entry.bounds;
  }
  return customBoundsIndex;
}

function buildRecoveredRegionsFromIndex(
  index: PersistedIndex,
  emptyRegions: Record<string, RegionPackStatus>,
): Record<string, RegionPackStatus> {
  const regions: Record<string, RegionPackStatus> = { ...emptyRegions };
  for (const [regionId, entry] of Object.entries(index)) {
    regions[regionId] = {
      ...emptyStatus(regionId),
      custom: entry.custom,
      displayName: entry.name,
      packId: entry.packId,
      state: 'error',
      error: t('downloads.errorPackUnavailable'),
      legacy: isLegacyRegionPackId(regionId),
      seamarksIndexed: entry.seamarksIndexed ?? false,
    };
  }
  return regions;
}

async function removeNativePack(packId: string | null | undefined) {
  if (!packId) return;
  try {
    await OfflineManager.deletePack(packId);
  } catch {
    /* may already be gone */
  }
}

/** Drop stale native packs for a region (e.g. after a watchdog failure left JS state empty). */
async function removeOrphanNativePacksForRegion(regionId: string, keepPackId?: string | null) {
  try {
    const nativePacks = await OfflineManager.getPacks();
    for (const pack of nativePacks) {
      if (pack.metadata?.regionId === regionId && pack.id !== keepPackId) {
        await removeNativePack(pack.id);
      }
    }
  } catch {
    /* best effort */
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
  chartStyleUri: string;
  previousPackId: string | null;
  previousWasReady: boolean;
  restoreOnFailure?: RegionPackStatus;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
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

function buildPackCreateOptions(ctx: DownloadSessionContext): OfflinePackCreateOptions {
  const name = ctx.customMeta?.displayName ?? ctx.finalizeExtra?.name ?? ctx.regionId;
  return {
    mapStyle: ctx.chartStyleUri,
    bounds: ctx.bounds,
    minZoom: ctx.minZoom,
    maxZoom: ctx.maxZoom,
    metadata: ctx.customMeta
      ? { regionId: ctx.regionId, name, custom: true, minZoom: ctx.minZoom, maxZoom: ctx.maxZoom }
      : { regionId: ctx.regionId, name: ctx.regionId },
  };
}

function createDownloadSession(
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
  get: () => OfflinePackStore,
) {
  type FinalizeOutcome = 'pending' | 'ready' | 'failed';
  let finalizeOutcome: FinalizeOutcome = 'pending';
  let stopWatchdog: (() => void) | null = null;

  const clearWatchdog = () => {
    stopWatchdog?.();
    stopWatchdog = null;
  };

  const markReady = async (packId: string, status: OfflinePackStatus) => {
    if (finalizeOutcome !== 'pending') return;
    if (!isNativeDownloadComplete(status)) return;
    finalizeOutcome = 'ready';
    clearWatchdog();
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

  const markFailed = async (packId: string | null, message: string, diagnostics?: StallDiagnostics) => {
    if (finalizeOutcome !== 'pending') return;
    finalizeOutcome = 'failed';
    clearWatchdog();
    finishDownloadSession(ctx.regionId, set);
    if (diagnostics) rememberDownloadFailureDiagnostics(ctx.regionId, diagnostics);
    await removeNativePack(packId);

    if (ctx.restoreOnFailure) {
      set((state) => ({
        regions: {
          ...state.regions,
          [ctx.regionId]: { ...ctx.restoreOnFailure!, error: message },
        },
      }));
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
      ...(ctx.customMeta && ctx.bounds
        ? { customBoundsIndex: { ...state.customBoundsIndex, [ctx.regionId]: ctx.bounds } }
        : {}),
    }));
  };

  const onProgress = (offlinePack: OfflinePack | null | undefined, rawStatus: OfflinePackStatus) => {
    if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
    const packId = offlinePack?.id;
    if (!packId) return;
    const status = resolveNativePackStatus(rawStatus, packId);
    set((state) => ({
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          ...statusFromNative(ctx.regionId, packId, status, { sessionActive: true }),
          ...ctx.customMeta,
          seamarksIndexed: state.regions[ctx.regionId]?.seamarksIndexed,
          seamarksIndexing: state.regions[ctx.regionId]?.seamarksIndexing,
        },
      },
    }));
    void markReady(packId, status);
  };

  const onError = (offlinePack: OfflinePack | null | undefined, error: unknown) => {
    if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
    void markFailed(offlinePack?.id ?? null, formatDownloadError(error, t('downloads.statusError')));
  };

  const sessionPackRef = { current: null as OfflinePack | null };

  const attachWatchdog = (initialPack: OfflinePack) => {
    sessionPackRef.current = initialPack;
    clearWatchdog();
    stopWatchdog = startDownloadStallWatchdog(
      ctx.regionId,
      ctx.session,
      initialPack,
      (message, diagnostics) => {
        void markFailed(sessionPackRef.current?.id ?? null, message, diagnostics);
      },
      t('downloads.errorDownloadStalled'),
      (status) => {
        if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
        const packId = sessionPackRef.current?.id;
        if (!packId) return;
        const normalized = resolveNativePackStatus(status, packId);
        set((state) => ({
          regions: {
            ...state.regions,
            [ctx.regionId]: {
              ...statusFromNative(ctx.regionId, packId, normalized, { sessionActive: true }),
              ...ctx.customMeta,
              seamarksIndexed: state.regions[ctx.regionId]?.seamarksIndexed,
              seamarksIndexing: state.regions[ctx.regionId]?.seamarksIndexing,
            },
          },
        }));
        void markReady(packId, normalized);
      },
      {
        chartStyleUri: ctx.chartStyleUri,
        mapEngineStallMessage: t('downloads.errorMapEngineStyle'),
        onRecreatePack: async (currentPack) => {
          if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return null;
          if (!ctx.chartStyleUri) return null;
          const replacement = await recreateOfflinePack(
            currentPack,
            buildPackCreateOptions(ctx),
            onProgress,
            onError,
            () => !downloadCoordinator.isStale(ctx.regionId, ctx.session),
          );
          if (!replacement?.id || downloadCoordinator.isStale(ctx.regionId, ctx.session)) return replacement;
          sessionPackRef.current = replacement;
          set((state) => ({
            regions: {
              ...state.regions,
              [ctx.regionId]: {
                ...(state.regions[ctx.regionId] ?? emptyStatus(ctx.regionId)),
                regionId: ctx.regionId,
                state: 'downloading',
                percentage: 0,
                packId: replacement.id,
                error: null,
                ...ctx.customMeta,
              },
            },
          }));
          return replacement;
        },
      },
    );
  };

  return { markReady, markFailed, onProgress, onError, attachWatchdog, clearWatchdog };
}

async function reattachDownloadingPack(
  pack: OfflinePack,
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
  get: () => OfflinePackStore,
) {
  if (!downloadCoordinator.restoreActive(ctx.regionId)) return;

  const { markReady, markFailed, onProgress, onError, attachWatchdog } = createDownloadSession(ctx, set, get);
  try {
    ensureMapLibreNetworkForDownload();
    await OfflineManager.addListener(pack.id, onProgress, onError);
    attachWatchdog(pack);
    const status = await kickstartNativeDownload(
      pack,
      ctx.chartStyleUri,
      () => !downloadCoordinator.isStale(ctx.regionId, ctx.session),
    );
    set((state) => ({
      ...syncActiveDownloadId(),
      regions: {
        ...state.regions,
        [ctx.regionId]: {
          ...statusFromNative(ctx.regionId, pack.id, status, { sessionActive: true, current: state.regions[ctx.regionId] }),
          ...ctx.customMeta,
          seamarksIndexed: state.regions[ctx.regionId]?.seamarksIndexed,
          seamarksIndexing: state.regions[ctx.regionId]?.seamarksIndexing,
        },
      },
    }));
    await markReady(pack.id, status);
  } catch (err) {
    await markFailed(pack.id, formatDownloadError(err, t('downloads.statusError')));
  }
}

/** Some native builds need an explicit resume and polling after createPack before tiles download. */
export async function kickstartNativeDownload(
  pack: OfflinePack,
  chartStyleUri?: string,
  isSessionActive?: () => boolean,
): Promise<OfflinePackStatus> {
  const sessionLive = () => isSessionActive?.() !== false;

  ensureMapLibreNetworkForDownload();

  const tryResume = async (usePauseCycle = false) => {
    if (!sessionLive()) return;
    ensureMapLibreNetworkForDownload();
    try {
      await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false });
    } catch {
      /* best effort */
    }
    if (usePauseCycle) {
      try {
        await pack.pause();
      } catch {
        /* native may already be inactive */
      }
    }
    ensureMapLibreNetworkForDownload();
    try {
      await pack.resume();
    } catch {
      /* native may already be active */
    }
  };

  let status = await pollNativePackStatus(pack);
  if (!sessionLive()) return status ?? initializingNativePackStatus(pack.id);
  if (isNativeDownloadComplete(status)) return status!;

  await tryResume();
  if (!sessionLive()) return status ?? initializingNativePackStatus(pack.id);
  status = await pollNativePackStatus(pack);
  if (isNativeDownloadComplete(status)) return status!;
  if (isNativeDownloadKickstarted(status)) return status ?? initializingNativePackStatus(pack.id);

  // Native often reports requiredResourceCount=0–1 / active before tile enumeration — poll until
  // resources are queued or bytes move (otherwise downloads appear to "do nothing").
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!sessionLive()) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
    ensureMapLibreNetworkForDownload();
    status = await pollNativePackStatus(pack);
    if (isNativeDownloadComplete(status)) return status!;
    if (isNativeDownloadKickstarted(status)) return status ?? initializingNativePackStatus(pack.id);
    if (attempt === 1 || attempt === 4 || attempt === 8 || attempt === 12 || attempt === 16) {
      await tryResume(attempt >= 8);
    }
  }

  if (!sessionLive()) return status ?? initializingNativePackStatus(pack.id);

  if (!isNativeDownloadKickstarted(status) && chartStyleUri && !isOfflineMapEngineStyleLoaded(chartStyleUri)) {
    await ensureOfflineMapEnginePrimedBeforeDownload(chartStyleUri);
    if (!sessionLive()) return status ?? initializingNativePackStatus(pack.id);
    await tryResume(true);
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!sessionLive()) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
      ensureMapLibreNetworkForDownload();
      status = await pollNativePackStatus(pack);
      if (isNativeDownloadComplete(status)) return status!;
      if (isNativeDownloadKickstarted(status)) return status ?? initializingNativePackStatus(pack.id);
    }
  } else if (!sessionLive()) {
    return status ?? initializingNativePackStatus(pack.id);
  } else if (!isNativeDownloadKickstarted(status)) {
    await tryResume(true);
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!sessionLive()) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
      ensureMapLibreNetworkForDownload();
      status = await pollNativePackStatus(pack);
      if (isNativeDownloadComplete(status)) return status!;
      if (isNativeDownloadKickstarted(status)) return status ?? initializingNativePackStatus(pack.id);
    }
  }

  return status ?? initializingNativePackStatus(pack.id);
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
      try {
        chartStyleUri = await ensureChartStyleFile();
      } catch (error) {
        console.warn('[offlinePackStore] chart style unavailable', error);
      }

      try {
        // Boot must not wait for the hidden map host — it mounts after BootGate completes.
        await warmupOfflineEngine(chartStyleUri ?? undefined, { requireStyleLoaded: false });
      } catch (error) {
        console.warn('[offlinePackStore] offline engine warmup failed', error);
      }

      const index = await loadIndex();
      const { packs: nativePacksRaw, ok: nativeOk } = await loadNativePacksWithRetry(
        () => OfflineManager.getPacks(),
        BOOT_NATIVE_PACK_ATTEMPTS,
        300,
        BOOT_NATIVE_PACK_TIMEOUT_MS,
      );
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
        const nativeStatus = await readHydrateNativePackStatus(native);
        if (!nativeStatus) {
          regions[regionId] = {
            ...emptyStatus(regionId),
            packId: native.id,
            state: 'error',
            error: t('downloads.errorStatusFailed'),
            custom: entry.custom,
            displayName: entry.name,
            legacy: isLegacyRegionPackId(regionId),
          };
          continue;
        }
        const status = statusFromNative(regionId, native.id, nativeStatus);
        regions[regionId] = {
          ...status,
          custom: entry.custom,
          displayName: entry.name,
          seamarksIndexed: entry.seamarksIndexed ?? false,
          legacy: isLegacyRegionPackId(regionId),
        };
      }

      for (const pack of nativePacks) {
        const regionId = typeof pack.metadata?.regionId === 'string' ? pack.metadata.regionId : null;
        if (!regionId || regions[regionId]?.packId) continue;
        const status = await readHydrateNativePackStatus(pack);
        if (!status) continue;
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
      }

      const customBoundsIndex = buildCustomBoundsIndex(index);

      await saveIndex(index);

      let restoredDownloadId: string | null = null;
      for (const [regionId, regionStatus] of Object.entries(regions)) {
        if (regionStatus.state !== 'downloading' || !regionStatus.packId) continue;
        if (restoredDownloadId) {
          regions[regionId] = {
            ...regionStatus,
            state: 'error',
            packId: null,
            error: t('downloads.errorDownloadInterrupted'),
          };
          continue;
        }
        const native = nativePacks.find((p) => p.id === regionStatus.packId);
        if (!native) continue;
        const entry = index[regionId];
        const bounds = entry?.bounds ?? getRegionPack(regionId)?.bounds;
        if (!bounds) continue;
        const regionDef = getRegionPack(regionId);
        const minZoom = entry?.minZoom ?? regionDef?.minZoom ?? 10;
        const maxZoom = entry?.maxZoom ?? regionDef?.maxZoom ?? 14;
        restoredDownloadId = regionId;
        const customMeta = entry?.custom
          ? { custom: true as const, displayName: entry.name ?? regionId }
          : undefined;
        void reattachDownloadingPack(
          native,
          {
            regionId,
            session: downloadCoordinator.sessionToken(regionId) || 1,
            chartStyleUri: chartStyleUri ?? (await ensureChartStyleFile()),
            previousPackId: null,
            previousWasReady: false,
            bounds,
            minZoom,
            maxZoom,
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
      try {
        const index = await loadIndex();
        set({
          hydrated: true,
          chartStyleUri,
          regions: buildRecoveredRegionsFromIndex(index, emptyRegions),
          customBoundsIndex: buildCustomBoundsIndex(index),
          activeDownloadRegionId: null,
        });
      } catch {
        set({ hydrated: true, chartStyleUri, regions: emptyRegions, customBoundsIndex: {}, activeDownloadRegionId: null });
      }
    } finally {
      if (!get().hydrated) {
        set({
          hydrated: true,
          chartStyleUri,
          regions: emptyRegions,
          customBoundsIndex: {},
          activeDownloadRegionId: null,
        });
      }
    }
  },

  ensureHydratedForUi: async () => {
    if (get().hydrated) return;
    const emptyRegions = Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)]));
    let chartStyleUri: string | null = get().chartStyleUri;
    if (!chartStyleUri) {
      try {
        chartStyleUri = await ensureChartStyleFile();
      } catch {
        chartStyleUri = null;
      }
    }
    try {
      const index = await loadIndex();
      set({
        hydrated: true,
        chartStyleUri,
        regions: buildRecoveredRegionsFromIndex(index, emptyRegions),
        customBoundsIndex: buildCustomBoundsIndex(index),
        activeDownloadRegionId: downloadCoordinator.getActiveRegionId(),
      });
    } catch {
      set({
        hydrated: true,
        chartStyleUri,
        regions: emptyRegions,
        customBoundsIndex: {},
        activeDownloadRegionId: downloadCoordinator.getActiveRegionId(),
      });
    }
    void get().hydrate();
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
    await assertChartDownloadNetworkReady(
      resolveChartTileProbeCenter(regionId, get().customBoundsIndex),
    );

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
      chartStyleUri: '',
      previousPackId,
      previousWasReady,
      restoreOnFailure: previousWasReady ? previous : undefined,
      bounds: packDef.bounds,
      minZoom: packDef.minZoom,
      maxZoom: packDef.maxZoom,
    };
    const { markReady, markFailed, onProgress, onError, attachWatchdog } = createDownloadSession(ctx, set, get);

    let newPackId: string | null = null;

    try {
      const chartStyleUri = await get().ensureChartStyle();
      ctx.chartStyleUri = chartStyleUri;
      await yieldToUi();
      await removeOrphanNativePacksForRegion(regionId);
      await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
      await ensureOfflineMapEnginePrimedBeforeDownload(chartStyleUri);
      ensureMapLibreNetworkForDownload();

      const pack = await OfflineManager.createPack(buildPackCreateOptions(ctx), onProgress, onError);
      if (!pack?.id) {
        throw new Error(t('downloads.errorStatusFailed'));
      }

      newPackId = pack.id;
      try {
        await OfflineManager.addListener(pack.id, onProgress, onError);
      } catch {
        /* createPack callbacks may already be wired */
      }
      set((state) => ({
        regions: {
          ...state.regions,
          [regionId]: {
            ...(state.regions[regionId] ?? emptyStatus(regionId)),
            regionId,
            state: 'downloading',
            percentage: 0,
            packId: pack.id,
            error: null,
          },
        },
      }));
      attachWatchdog(pack);
      void kickstartNativeDownload(
        pack,
        chartStyleUri,
        () => !downloadCoordinator.isStale(regionId, session),
      )
        .then((status) => {
          if (downloadCoordinator.isStale(regionId, session)) return;
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: statusFromNative(regionId, pack.id, status, {
                sessionActive: true,
                current: state.regions[regionId],
              }),
            },
          }));
          void markReady(pack.id, status);
        })
        .catch((kickErr) => {
          if (downloadCoordinator.isStale(regionId, session)) return;
          void markFailed(pack.id, formatDownloadError(kickErr, t('downloads.statusError')));
        });
    } catch (err) {
      await markFailed(newPackId, formatDownloadError(err, t('downloads.statusError')));
      throw err;
    }
  },

  startCustomDownload: async (name, bounds, minZoom = 10, maxZoom = 14, existingRegionId) => {
    const regionId = existingRegionId ?? `custom_${Date.now().toString(36)}`;

    const boundsValidation = validateDownloadBounds(bounds, minZoom, maxZoom);
    if (!boundsValidation.ok) {
      throw new Error(t(`downloads.customInvalid.${boundsValidation.code}` as 'downloads.customInvalid.too_small'));
    }

    await assertStorageForBounds(bounds, minZoom, maxZoom);
    await assertChartDownloadNetworkReady(boundsCenter(bounds));

    const session = downloadCoordinator.tryBegin(regionId);
    if (session == null) {
      throw new Error(t('downloads.errorDownloadBusy'));
    }

    const previous = get().regions[regionId] ?? emptyStatus(regionId);
    if (previous.packId && previous.state !== 'ready') {
      await removeNativePack(previous.packId);
    }

    const customMeta = { custom: true as const, displayName: name };
    const ctx: DownloadSessionContext = {
      regionId,
      session,
      chartStyleUri: '',
      previousPackId: null,
      previousWasReady: false,
      bounds,
      minZoom,
      maxZoom,
      customMeta,
      finalizeExtra: { name, custom: true, displayName: name, bounds, minZoom, maxZoom },
    };
    const { markReady, markFailed, onProgress, onError, attachWatchdog } = createDownloadSession(ctx, set, get);

    let newPackId: string | null = null;

    try {
      const chartStyleUri = await get().ensureChartStyle();
      ctx.chartStyleUri = chartStyleUri;
      await yieldToUi();
      await removeOrphanNativePacksForRegion(regionId);
      await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
      await ensureOfflineMapEnginePrimedBeforeDownload(chartStyleUri);
      ensureMapLibreNetworkForDownload();

      set({
        ...syncActiveDownloadId(),
        customBoundsIndex: { ...get().customBoundsIndex, [regionId]: bounds },
        regions: {
          ...get().regions,
          [regionId]: { regionId, state: 'downloading', percentage: 0, packId: null, error: null, ...customMeta },
        },
      });

      const pack = await OfflineManager.createPack(buildPackCreateOptions(ctx), onProgress, onError);
      if (!pack?.id) {
        throw new Error(t('downloads.errorStatusFailed'));
      }

      newPackId = pack.id;
      try {
        await OfflineManager.addListener(pack.id, onProgress, onError);
      } catch {
        /* createPack callbacks may already be wired */
      }
      set((state) => ({
        regions: {
          ...state.regions,
          [regionId]: {
            ...(state.regions[regionId] ?? { regionId, ...customMeta }),
            regionId,
            state: 'downloading',
            percentage: 0,
            packId: pack.id,
            error: null,
            ...customMeta,
          },
        },
      }));
      attachWatchdog(pack);
      void kickstartNativeDownload(
        pack,
        chartStyleUri,
        () => !downloadCoordinator.isStale(regionId, session),
      )
        .then((status) => {
          if (downloadCoordinator.isStale(regionId, session)) return;
          set((state) => ({
            regions: {
              ...state.regions,
              [regionId]: {
                ...statusFromNative(regionId, pack.id, status, { sessionActive: true, current: state.regions[regionId] }),
                ...customMeta,
              },
            },
          }));
          void markReady(pack.id, status);
        })
        .catch((kickErr) => {
          if (downloadCoordinator.isStale(regionId, session)) return;
          void markFailed(pack.id, formatDownloadError(kickErr, t('downloads.statusError')));
        });
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
    const sessionActive = downloadCoordinator.getActiveRegionId() === regionId;
    if (!current || (current.state !== 'downloading' && !sessionActive)) return;

    downloadCoordinator.invalidate(regionId);
    const packId = current.packId;
    if (packId) {
      await removeNativePack(packId);
    } else {
      try {
        const nativePacks = await OfflineManager.getPacks();
        for (const pack of nativePacks) {
          if (pack.metadata?.regionId === regionId) {
            await removeNativePack(pack.id);
          }
        }
      } catch {
        /* best effort */
      }
    }

    const index = await loadIndex();
    const indexedPackId = index[regionId]?.packId;
    const nextCustom = { ...get().customBoundsIndex };

    if (indexedPackId && indexedPackId !== packId) {
      try {
        const nativePacks = await OfflineManager.getPacks();
        const native = nativePacks.find((p) => p.id === indexedPackId);
        if (native) {
          const nativeStatus = await readHydrateNativePackStatus(native);
          if (!nativeStatus) {
            set({
              ...syncActiveDownloadId(),
              customBoundsIndex: nextCustom,
              regions: {
                ...get().regions,
                [regionId]: {
                  ...emptyStatus(regionId),
                  custom: current.custom,
                  displayName: current.displayName,
                  state: 'error',
                  error: t('downloads.errorStatusFailed'),
                },
              },
            });
            return;
          }
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
    const sessionActive = downloadCoordinator.getActiveRegionId() === regionId;
    if (current?.state === 'downloading' || sessionActive) {
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
    const uri = await ensureChartStyleFile();
    set({ chartStyleUri: uri });
    return uri;
  },

  preflightDownloadLock: (regionId) => {
    if (!downloadCoordinator.preflightLock(regionId)) return false;
    set(syncActiveDownloadId());
    ensureMapLibreNetworkForDownload();
    return true;
  },

  releasePreflightDownloadLock: (regionId) => {
    downloadCoordinator.releasePreflightLock(regionId);
    set(syncActiveDownloadId());
  },

  markPreflightDownloadFailed: (regionId, message) => {
    set((state) => {
      const current = state.regions[regionId] ?? emptyStatus(regionId);
      if (current.state === 'ready' || current.state === 'downloading') return {};
      return {
        regions: {
          ...state.regions,
          [regionId]: {
            ...current,
            regionId,
            state: 'error',
            percentage: 0,
            packId: null,
            error: message,
          },
        },
      };
    });
  },

  resetDownloadErrorForRetry: (regionId) => {
    set((state) => {
      const current = state.regions[regionId];
      if (!current || current.state !== 'error' || current.packId != null) return {};
      return {
        regions: {
          ...state.regions,
          [regionId]: { ...current, state: 'idle', error: null, percentage: 0 },
        },
      };
    });
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
  resetOfflineManagerSetupForTests();
  resetOfflineMapEngineHostForTests();
  useOfflinePackStore.setState({
    hydrated: false,
    chartStyleUri: null,
    customBoundsIndex: {},
    activeDownloadRegionId: null,
    regions: Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)])),
  });
}
