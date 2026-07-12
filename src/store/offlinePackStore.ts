import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OfflineManager,
  type LngLatBounds,
  type OfflinePack,
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
import { abandonDownloadSession, beginDownloadSession } from '../lib/offline/beginDownloadSession';
import {
  clearDownloadSessionPhase,
  rememberDownloadSessionPhase,
} from '../lib/offline/downloadFailureDiagnostics';
import {
  downloadCoordinator,
  formatDownloadError,
  loadNativePacksWithRetry,
  resetDownloadCoordinatorForTests,
  subscribeDownloadCoordinatorActivity,
  waitForDownloadMapTeardown,
} from '../lib/offline/downloadCoordinator';
import { cacheBackedPackId, isCacheBackedPackId, runTileCacheSweep } from '../lib/offline/tileCacheDownload';
import { downloadMapLingerMs, tileSweepFinalSettleMs } from '../lib/offline/downloadMapConstants';
import { waitForDownloadMapController } from '../lib/offline/downloadMapHost';
import { isNativeDownloadKickstarted, isNativePackInitializing } from '../lib/offline/nativePackProgress';
import { initializingNativePackStatus, pollNativePackStatus, readNativePackStatus, resolveNativePackStatus } from '../lib/offline/nativePackStatus';
import type { OfflineEngineViewport } from '../lib/offline/offlineMapEngineHost';
import {
  ensureOfflineMapEngineReadyForDownload,
  isOfflineMapEngineStyleLoaded,
  isOfflineMapEngineViewportPrimed,
  resetOfflineMapEngineHostForTests,
} from '../lib/offline/offlineMapEngineHost';
import { yieldToUi } from '../lib/async/yieldToUi';
import { resetOfflineManagerSetupForTests } from '../lib/offline/offlineManagerSetup';
import { warmupOfflineEngine } from '../lib/offline/warmupOfflineEngine';
import { ensureStorageForDownload } from '../lib/offline/storageCheck';
import { sanitizePersistedIndex, type PersistedIndex, type PersistedIndexEntry } from '../lib/offline/offlinePackIndex';
import {
  reportDownloadFailure,
  reportDownloadFailureFromThrowable,
} from '../lib/offline/reportDownloadFailure';

const STORAGE_KEY = 'seacheck.offline.v1';

/** Opens the copyable download failure modal. */
function showDownloadSessionFailure(regionId: string, error: unknown, phase: string): void {
  void reportDownloadFailureFromThrowable(regionId, error, 'async', phase);
}

function showDownloadSessionMessage(regionId: string, message: string, phase: string, cause?: unknown): void {
  if (cause != null) {
    showDownloadSessionFailure(regionId, cause, phase);
    return;
  }
  void reportDownloadFailure({
    regionId,
    message,
    source: 'async',
    extra: { phase },
  });
}

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
  /** Saved via visible-map tile sweep into ambient cache (not native OfflineManager). */
  cacheBacked?: boolean;
};

type OfflinePackStore = {
  hydrated: boolean;
  chartStyleUri: string | null;
  regions: Record<string, RegionPackStatus>;
  customBoundsIndex: Record<string, LngLatBounds>;
  activeDownloadRegionId: string | null;
  /** Keeps DownloadMapEngine mounted after coordinator lock clears (Android GL teardown). */
  downloadMapTeardownRegionId: string | null;
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

/** Pure read — malformed rows are dropped; hydrate persists the sanitized index. */
async function loadIndex(): Promise<PersistedIndex> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return sanitizePersistedIndex(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function saveIndex(index: PersistedIndex) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

/**
 * AsyncStorage has no transactions — concurrent read-modify-write cycles on the
 * persisted index (sweep progress ticks, finalize, seamark flags, cancel/delete)
 * would clobber each other. All mutations are serialized through this chain.
 */
let indexMutationChain: Promise<unknown> = Promise.resolve();

function withIndexMutation<T>(fn: () => Promise<T>): Promise<T> {
  const run = indexMutationChain.then(fn, fn);
  indexMutationChain = run.catch(() => undefined);
  return run;
}

/** Atomically load → mutate → save the persisted index. */
async function updateIndex(mutate: (index: PersistedIndex) => void): Promise<PersistedIndex> {
  return withIndexMutation(async () => {
    const index = await loadIndex();
    mutate(index);
    await saveIndex(index);
    return index;
  });
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
  return {
    activeDownloadRegionId: downloadCoordinator.getActiveRegionId(),
    downloadMapTeardownRegionId: downloadCoordinator.getTeardownRegionId(),
  };
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
    const cacheBacked = entry.cacheBacked || isCacheBackedPackId(entry.packId);
    const sweepInProgress =
      cacheBacked &&
      entry.sweepTotal != null &&
      entry.sweepCompleted != null &&
      entry.sweepCompleted < entry.sweepTotal;
    regions[regionId] = {
      ...emptyStatus(regionId),
      custom: entry.custom,
      displayName: entry.name,
      packId: entry.packId,
      state: cacheBacked && !sweepInProgress ? 'ready' : 'error',
      error: cacheBacked && !sweepInProgress ? null : t('downloads.errorPackUnavailable'),
      cacheBacked: cacheBacked || undefined,
      legacy: isLegacyRegionPackId(regionId),
      seamarksIndexed: entry.seamarksIndexed ?? false,
    };
  }
  return regions;
}

async function removeNativePack(packId: string | null | undefined) {
  if (!packId || isCacheBackedPackId(packId)) return;
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
    await updateIndex((index) => {
      if (index[regionId]) index[regionId].seamarksIndexed = true;
    });
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
  downloadCoordinator.beginMapTeardown(regionId);
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

function createCacheDownloadSession(
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
) {
  type FinalizeOutcome = 'pending' | 'ready' | 'failed';
  let finalizeOutcome: FinalizeOutcome = 'pending';
  const packId = cacheBackedPackId(ctx.regionId);

  const markReady = async () => {
    if (finalizeOutcome !== 'pending') return;
    finalizeOutcome = 'ready';
    rememberDownloadSessionPhase(ctx.regionId, 'finalize');
    try {
      await finalizeReadyDownload(
        ctx.regionId,
        packId,
        ctx.previousPackId,
        ctx.bounds,
        { ...ctx.finalizeExtra, cacheBacked: true },
      );
    } catch (error) {
      finalizeOutcome = 'pending';
      await markFailed(formatDownloadError(error, t('downloads.statusError')), error);
      return;
    }

    rememberDownloadSessionPhase(ctx.regionId, 'completing');
    try {
      // Finish native tile/GL work before flipping UI to completing — avoids peak pressure
      // while the banner re-renders and other surfaces would react to state: ready.
      await yieldToUi();
      try {
        const controller = await waitForDownloadMapController(3_000);
        if (controller && !downloadCoordinator.isStale(ctx.regionId, ctx.session)) {
          await controller.waitForFrame();
        }
      } catch {
        /* best effort */
      }
      await new Promise((resolve) => setTimeout(resolve, tileSweepFinalSettleMs()));
      if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;

      set((state) => ({
        regions: {
          ...state.regions,
          [ctx.regionId]: {
            regionId: ctx.regionId,
            state: 'ready',
            percentage: 100,
            packId,
            error: null,
            cacheBacked: true,
            ...ctx.customMeta,
            seamarksIndexed: false,
            seamarksIndexing: false,
          },
        },
        ...(ctx.finalizeExtra?.bounds
          ? { customBoundsIndex: { ...state.customBoundsIndex, [ctx.regionId]: ctx.finalizeExtra.bounds } }
          : {}),
      }));

      await yieldToUi();
      await yieldToUi();

      try {
        const controller = await waitForDownloadMapController(3_000);
        if (controller && !downloadCoordinator.isStale(ctx.regionId, ctx.session)) {
          await controller.waitForFrame();
        }
      } catch {
        /* best effort — linger below still guards native teardown */
      }

      await new Promise((resolve) => setTimeout(resolve, downloadMapLingerMs()));
      if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;

      rememberDownloadSessionPhase(ctx.regionId, 'teardown');
      finishDownloadSession(ctx.regionId, set);
      await waitForDownloadMapTeardown(ctx.regionId);
      if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
      // Failsafe: the wait above times out if the teardown timer was throttled
      // (background/Doze). Force-end the window so the map hand-off always completes;
      // no-op when the window already closed normally. Runs only while this session
      // still owns the region, so it can never cut short a later session's window.
      downloadCoordinator.cancelMapTeardown(ctx.regionId);
      clearDownloadSessionPhase(ctx.regionId);
      void scheduleSeamarkIndexing(ctx.regionId, ctx.bounds);
    } catch (error) {
      const uiAlreadyReady = useOfflinePackStore.getState().regions[ctx.regionId]?.state === 'ready';
      downloadCoordinator.cancelMapTeardown(ctx.regionId);
      set(syncActiveDownloadId());
      clearDownloadSessionPhase(ctx.regionId);
      if (!uiAlreadyReady) {
        finalizeOutcome = 'pending';
        await markFailed(formatDownloadError(error, t('downloads.statusError')), error);
        return;
      }
      // Charts were persisted — keep ready state but surface a copyable debug report
      // instead of crashing or leaving the completing banner stuck forever.
      showDownloadSessionFailure(ctx.regionId, error, 'completing');
    }
  };

  const markFailed = async (message: string, cause?: unknown) => {
    if (finalizeOutcome !== 'pending') return;
    finalizeOutcome = 'failed';
    const phase = 'sweep';
    finishDownloadSession(ctx.regionId, set);
    clearDownloadSessionPhase(ctx.regionId);

    if (ctx.restoreOnFailure) {
      set((state) => ({
        regions: {
          ...state.regions,
          [ctx.regionId]: { ...ctx.restoreOnFailure!, error: message },
        },
      }));
      // Sweep-progress ticks marked the persisted entry as downloading; clear the
      // sweep fields so a restart hydrates the previous ready pack instead of
      // silently re-attaching the failed download.
      try {
        await updateIndex((index) => {
          const entry = index[ctx.regionId];
          if (entry) {
            entry.sweepCompleted = undefined;
            entry.sweepTotal = undefined;
          }
        });
      } catch {
        /* best effort — UI state is already restored */
      }
      showDownloadSessionMessage(ctx.regionId, message, phase, cause);
      return;
    }

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
    try {
      await updateIndex((index) => {
        delete index[ctx.regionId];
      });
    } catch {
      /* best effort — error state is already visible; hydrate re-checks the entry */
    }
    showDownloadSessionMessage(ctx.regionId, message, phase, cause);
  };

  const persistSweepProgress = async (completed: number, total: number) => {
    await updateIndex((index) => {
      // Never regress a finalized/failed outcome with a late progress tick.
      if (finalizeOutcome !== 'pending') return;
      index[ctx.regionId] = {
        packId,
        name: ctx.finalizeExtra?.name ?? ctx.customMeta?.displayName ?? index[ctx.regionId]?.name,
        custom: ctx.customMeta != null ? true : index[ctx.regionId]?.custom,
        bounds: ctx.bounds,
        minZoom: ctx.minZoom,
        maxZoom: ctx.maxZoom,
        cacheBacked: true,
        sweepCompleted: completed,
        sweepTotal: total,
        seamarksIndexed: index[ctx.regionId]?.seamarksIndexed,
      };
    });
  };

  const runSweep = async (startIndex = 0) => {
    rememberDownloadSessionPhase(ctx.regionId, 'sweep');
    await yieldToUi();
    const sweepLeadMs = process.env.NODE_ENV === 'test' ? 0 : 400;
    await new Promise((resolve) => setTimeout(resolve, sweepLeadMs));

    const totalLevels = ctx.maxZoom - ctx.minZoom + 1;
    await persistSweepProgress(startIndex, totalLevels);

    try {
      const result = await runTileCacheSweep({
        chartStyleUri: ctx.chartStyleUri,
        bounds: ctx.bounds,
        minZoom: ctx.minZoom,
        maxZoom: ctx.maxZoom,
        startIndex,
        isCancelled: () => downloadCoordinator.isStale(ctx.regionId, ctx.session),
        onProgress: (progress) => {
          if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
          if (finalizeOutcome !== 'pending') return;
          persistSweepProgress(progress.completed, progress.total).catch(() => {
            /* progress persistence is best effort — the sweep itself continues */
          });
          set((state) => ({
            regions: {
              ...state.regions,
              [ctx.regionId]: {
                ...(state.regions[ctx.regionId] ?? emptyStatus(ctx.regionId)),
                regionId: ctx.regionId,
                state: 'downloading',
                percentage: progress.percentage,
                packId,
                error: null,
                cacheBacked: true,
                downloadInitializing: progress.percentage <= 0,
                ...ctx.customMeta,
              },
            },
          }));
        },
      });

      if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
      if (result.percentage < 100) {
        await markFailed(t('downloads.errorDownloadStalled'));
        return;
      }
      await markReady();
    } catch (error) {
      if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
      const code = error instanceof Error ? error.message : '';
      if (code === 'DOWNLOAD_MAP_NOT_READY') {
        await markFailed(t('downloads.errorMapEngineStyle'), error);
        return;
      }
      await markFailed(formatDownloadError(error, t('downloads.errorDownloadStalled')), error);
    }
  };

  return { markReady, markFailed, runSweep };
}

async function reattachCacheDownload(
  entry: PersistedIndexEntry,
  ctx: DownloadSessionContext,
  set: (partial: Partial<OfflinePackStore> | ((state: OfflinePackStore) => Partial<OfflinePackStore>)) => void,
) {
  if (!downloadCoordinator.restoreActive(ctx.regionId)) return;
  const { runSweep } = createCacheDownloadSession(ctx, set);
  const startIndex = entry.sweepCompleted ?? 0;
  set((state) => ({
    ...syncActiveDownloadId(),
    regions: {
      ...state.regions,
      [ctx.regionId]: {
        regionId: ctx.regionId,
        state: 'downloading',
        percentage: entry.sweepTotal
          ? Math.min(99, Math.round(((entry.sweepCompleted ?? 0) / entry.sweepTotal) * 100))
          : 0,
        packId: cacheBackedPackId(ctx.regionId),
        error: null,
        cacheBacked: true,
        custom: entry.custom,
        displayName: entry.name,
      },
    },
  }));
  void runSweep(startIndex).catch((error) => {
    if (downloadCoordinator.isStale(ctx.regionId, ctx.session)) return;
    showDownloadSessionFailure(ctx.regionId, error, 'sweep');
  });
}

/** Some native builds need an explicit resume and polling after createPack before tiles download. */
export async function kickstartNativeDownload(
  pack: OfflinePack,
  chartStyleUri?: string,
  isSessionActive?: () => boolean,
  viewport?: OfflineEngineViewport,
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

  const needsEnginePriming =
    chartStyleUri != null &&
    viewport != null &&
    (!isOfflineMapEngineStyleLoaded(chartStyleUri) || !isOfflineMapEngineViewportPrimed(viewport));

  if (!isNativeDownloadKickstarted(status) && needsEnginePriming) {
    await ensureOfflineMapEngineReadyForDownload(chartStyleUri!, viewport!);
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
  extra?: {
    custom?: boolean;
    displayName?: string;
    name?: string;
    minZoom?: number;
    maxZoom?: number;
    bounds?: LngLatBounds;
    cacheBacked?: boolean;
  },
) {
  await updateIndex((index) => {
    index[regionId] = {
      packId: newPackId,
      seamarksIndexed: false,
      name: extra?.name ?? extra?.displayName ?? index[regionId]?.name,
      custom: extra?.custom ?? index[regionId]?.custom,
      bounds: extra?.bounds ?? index[regionId]?.bounds ?? bounds,
      minZoom: extra?.minZoom ?? index[regionId]?.minZoom,
      maxZoom: extra?.maxZoom ?? index[regionId]?.maxZoom,
      cacheBacked: extra?.cacheBacked ?? index[regionId]?.cacheBacked,
      sweepCompleted: undefined,
      sweepTotal: undefined,
    };
  });

  if (previousPackId && previousPackId !== newPackId) {
    await removeNativePack(previousPackId);
  }
}

export const useOfflinePackStore = create<OfflinePackStore>((set, get) => ({
  hydrated: false,
  chartStyleUri: null,
  customBoundsIndex: {},
  activeDownloadRegionId: null,
  downloadMapTeardownRegionId: null,
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
        if (entry.cacheBacked || isCacheBackedPackId(entry.packId)) {
          const sweepInProgress =
            entry.sweepTotal != null &&
            entry.sweepCompleted != null &&
            entry.sweepCompleted < entry.sweepTotal;
          const percentage = sweepInProgress
            ? Math.min(99, Math.round(((entry.sweepCompleted ?? 0) / (entry.sweepTotal ?? 1)) * 100))
            : 100;
          regions[regionId] = {
            regionId,
            state: sweepInProgress ? 'downloading' : 'ready',
            percentage,
            packId: entry.packId,
            error: null,
            cacheBacked: true,
            custom: entry.custom,
            displayName: entry.name,
            seamarksIndexed: entry.seamarksIndexed ?? false,
            legacy: isLegacyRegionPackId(regionId),
          };
          continue;
        }

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

      await withIndexMutation(() => saveIndex(index));

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
        const ctx: DownloadSessionContext = {
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
        };

        if (entry?.cacheBacked || regionStatus.cacheBacked) {
          void reattachCacheDownload(entry, ctx, set);
          continue;
        }

        regions[regionId] = {
          ...regionStatus,
          state: 'error',
          packId: null,
          error: t('downloads.errorDownloadInterrupted'),
        };
      }

      set({
        hydrated: true,
        chartStyleUri,
        regions,
        customBoundsIndex,
        ...syncActiveDownloadId(),
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
          downloadMapTeardownRegionId: null,
        });
      } catch {
        set({ hydrated: true, chartStyleUri, regions: emptyRegions, customBoundsIndex: {}, activeDownloadRegionId: null, downloadMapTeardownRegionId: null });
      }
    } finally {
      if (!get().hydrated) {
        set({
          hydrated: true,
          chartStyleUri,
          regions: emptyRegions,
          customBoundsIndex: {},
          activeDownloadRegionId: null,
          downloadMapTeardownRegionId: null,
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
        ...syncActiveDownloadId(),
      });
    } catch {
      set({
        hydrated: true,
        chartStyleUri,
        regions: emptyRegions,
        customBoundsIndex: {},
        ...syncActiveDownloadId(),
      });
    }
    void get().hydrate();
  },

  startDownload: async (regionId) => {
    let session: number | null = null;
    let markFailed: ((message: string, cause?: unknown) => Promise<void>) | null = null;

    try {
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

      session = beginDownloadSession(regionId);

      const previous = get().regions[regionId] ?? emptyStatus(regionId);
      const previousPackId = previous.state === 'ready' ? previous.packId : null;
      const previousWasReady = previous.state === 'ready';

      if (previous.packId && previous.state !== 'ready') {
        await removeNativePack(previous.packId);
      }

      const packId = cacheBackedPackId(regionId);
      set({
        ...syncActiveDownloadId(),
        regions: {
          ...get().regions,
          [regionId]: {
            regionId,
            state: 'downloading',
            percentage: 0,
            packId,
            error: null,
            cacheBacked: true,
            downloadInitializing: true,
          },
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
      const sessionHandlers = createCacheDownloadSession(ctx, set);
      markFailed = sessionHandlers.markFailed;

      const chartStyleUri = await get().ensureChartStyle();
      ctx.chartStyleUri = chartStyleUri;
      await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
      ensureMapLibreNetworkForDownload();

      await sessionHandlers.runSweep();
    } catch (err) {
      if (session == null) {
        abandonDownloadSession(regionId);
        set(syncActiveDownloadId());
        throw err;
      }
      if (markFailed) {
        await markFailed(formatDownloadError(err, t('downloads.statusError')), err);
      }
      throw err;
    }
  },

  startCustomDownload: async (name, bounds, minZoom = 10, maxZoom = 14, existingRegionId) => {
    const regionId = existingRegionId ?? `custom_${Date.now().toString(36)}`;
    let session: number | null = null;
    let markFailed: ((message: string, cause?: unknown) => Promise<void>) | null = null;

    try {
      const boundsValidation = validateDownloadBounds(bounds, minZoom, maxZoom);
      if (!boundsValidation.ok) {
        throw new Error(t(`downloads.customInvalid.${boundsValidation.code}` as 'downloads.customInvalid.too_small'));
      }

      await assertStorageForBounds(bounds, minZoom, maxZoom);
      await assertChartDownloadNetworkReady(boundsCenter(bounds));

      session = beginDownloadSession(regionId);

      const previous = get().regions[regionId] ?? emptyStatus(regionId);
      const previousWasReady = previous.state === 'ready';
      if (previous.packId && !previousWasReady) {
        await removeNativePack(previous.packId);
      }

      const customMeta = { custom: true as const, displayName: name };
      const packId = cacheBackedPackId(regionId);
      set({
        ...syncActiveDownloadId(),
        customBoundsIndex: { ...get().customBoundsIndex, [regionId]: bounds },
        regions: {
          ...get().regions,
          [regionId]: {
            regionId,
            state: 'downloading',
            percentage: 0,
            packId,
            error: null,
            cacheBacked: true,
            downloadInitializing: true,
            ...customMeta,
          },
        },
      });

      const ctx: DownloadSessionContext = {
        regionId,
        session,
        chartStyleUri: '',
        previousPackId: previousWasReady ? previous.packId : null,
        previousWasReady,
        restoreOnFailure: previousWasReady ? previous : undefined,
        bounds,
        minZoom,
        maxZoom,
        customMeta,
        finalizeExtra: { name, custom: true, displayName: name, bounds, minZoom, maxZoom },
      };
      const sessionHandlers = createCacheDownloadSession(ctx, set);
      markFailed = sessionHandlers.markFailed;

      const chartStyleUri = await get().ensureChartStyle();
      ctx.chartStyleUri = chartStyleUri;
      await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
      ensureMapLibreNetworkForDownload();

      await sessionHandlers.runSweep();
    } catch (err) {
      if (session == null) {
        abandonDownloadSession(regionId);
        set(syncActiveDownloadId());
        throw err;
      }
      if (markFailed) {
        await markFailed(formatDownloadError(err, t('downloads.statusError')), err);
      }
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
    await updateIndex((latest) => {
      delete latest[regionId];
    });
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

    await updateIndex((index) => {
      delete index[regionId];
    });
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

/**
 * The coordinator ends the post-download GL teardown window on its own timer,
 * outside any store action. Without this subscription the store would keep a stale
 * `downloadMapTeardownRegionId` forever after a download finishes — leaving the app
 * stuck on the "saving charts" banner, the map replaced by the download placeholder,
 * every pack action locked, keep-awake held, and MapLibre forced online (which breaks
 * offline chart serving). Every lock/teardown change must be mirrored into the store.
 */
function attachDownloadCoordinatorStoreSync(): () => void {
  return subscribeDownloadCoordinatorActivity(() => {
    const state = useOfflinePackStore.getState();
    const next = syncActiveDownloadId();
    if (
      next.activeDownloadRegionId !== state.activeDownloadRegionId ||
      next.downloadMapTeardownRegionId !== state.downloadMapTeardownRegionId
    ) {
      useOfflinePackStore.setState(next);
    }
  });
}

attachDownloadCoordinatorStoreSync();

/** Test-only store reset. */
export function resetOfflinePackStoreForTests(): void {
  indexMutationChain = Promise.resolve();
  // Coordinator reset clears its activity listeners — the store sync must survive it.
  resetDownloadCoordinatorForTests();
  attachDownloadCoordinatorStoreSync();
  resetOfflineManagerSetupForTests();
  resetOfflineMapEngineHostForTests();
  useOfflinePackStore.setState({
    hydrated: false,
    chartStyleUri: null,
    customBoundsIndex: {},
    activeDownloadRegionId: null,
    downloadMapTeardownRegionId: null,
    regions: Object.fromEntries(REGION_PACKS.map((p) => [p.id, emptyStatus(p.id)])),
  });
}
