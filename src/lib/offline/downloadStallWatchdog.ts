import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { downloadCoordinator } from './downloadCoordinator';
import {
  ensureOfflineMapEngineViewportPrimed,
  isOfflineMapEngineStyleLoaded,
  requestOfflineMapEngineStyleReload,
  type OfflineEngineViewport,
} from './offlineMapEngineHost';
import { hasMeasurableDownloadProgress } from './nativePackProgress';
import { initializingNativePackStatus, pollNativePackStatus } from './nativePackStatus';
import { warmupOfflineEngine } from './warmupOfflineEngine';
import { yieldToUi } from '../async/yieldToUi';
import { getDownloadTiming } from './downloadTiming';

/** Attempt pause → warmup → resume on these resume indices (0-based, after threshold crossed). */
const PAUSE_RESUME_AT = new Set([1, 3]);
/** Recreate the native pack when enumeration never starts — after these resume indices. */
const RECREATE_AT = new Set([2, 4]);
const MAX_PACK_RECREATES = 2;

export type StallDiagnostics = {
  nativeState: string;
  percentage: number;
  completedResourceCount: number;
  requiredResourceCount: number;
  mapEngineStyleLoaded?: boolean;
};

export type DownloadStallWatchdogOptions = {
  chartStyleUri?: string;
  mapEngineStallMessage?: string;
  viewport?: OfflineEngineViewport;
  /** Replace a pack stuck at style-only enumeration. Returns the new pack when recreated. */
  onRecreatePack?: (currentPack: OfflinePack) => Promise<OfflinePack | null>;
};

function isNativeDownloadComplete(status: OfflinePackStatus | null | undefined): boolean {
  if (!status) return false;
  const nominallyComplete = status.state === 'complete' || status.percentage >= 100;
  if (!nominallyComplete) return false;
  if (status.requiredResourceCount <= 0) return false;
  return status.completedResourceCount >= status.requiredResourceCount;
}

function stallDiagnostics(status: OfflinePackStatus | null | undefined, chartStyleUri?: string): StallDiagnostics {
  return {
    nativeState: status?.state ?? 'unknown',
    percentage: status?.percentage ?? 0,
    completedResourceCount: status?.completedResourceCount ?? 0,
    requiredResourceCount: status?.requiredResourceCount ?? 0,
    mapEngineStyleLoaded: chartStyleUri ? isOfflineMapEngineStyleLoaded(chartStyleUri) : undefined,
  };
}

/**
 * Recover a stalled pack without remounting the hidden map when the style is already loaded.
 * Remounting during an active download destroys the GL context and prevents tile enumeration.
 */
async function recoverStalledPack(
  pack: OfflinePack,
  usePauseCycle: boolean,
  chartStyleUri?: string,
  viewport?: OfflineEngineViewport,
): Promise<void> {
  ensureMapLibreNetworkForDownload();
  const styleReady = !chartStyleUri || isOfflineMapEngineStyleLoaded(chartStyleUri);
  if (chartStyleUri && !styleReady) {
    requestOfflineMapEngineStyleReload();
    await yieldToUi();
  } else if (chartStyleUri && viewport && styleReady) {
    await ensureOfflineMapEngineViewportPrimed(chartStyleUri, viewport);
    await yieldToUi();
  }
  try {
    await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false });
  } catch {
    /* best effort — preflight should have validated style when possible */
  }
  if (usePauseCycle) {
    try {
      await pack.pause();
    } catch {
      /* may already be inactive */
    }
  }
  ensureMapLibreNetworkForDownload();
  try {
    await pack.resume();
  } catch {
    /* best effort */
  }
}

/**
 * Polls native pack status while a download session is active.
 * Fires when progress stays at 0% or stops advancing — native callbacks can be silent on some builds.
 */
export function startDownloadStallWatchdog(
  regionId: string,
  session: number,
  pack: OfflinePack,
  onStall: (message: string, diagnostics: StallDiagnostics) => void,
  stallMessage: string,
  onStatus?: (status: OfflinePackStatus) => void,
  options?: DownloadStallWatchdogOptions,
): () => void {
  const chartStyleUri = options?.chartStyleUri;
  const mapEngineStallMessage = options?.mapEngineStallMessage;
  const viewport = options?.viewport;
  const onRecreatePack = options?.onRecreatePack;
  const timing = getDownloadTiming();

  const startedAt = Date.now();
  let lastPercentage = 0;
  let lastCompletedResources = 0;
  let lastRequiredResources = 0;
  let lastAdvanceAt = startedAt;
  let resumeAttemptIndex = 0;
  let packRecreateCount = 0;
  let recreateInFlight = false;
  let currentPack = pack;
  let lastDiagnostics: StallDiagnostics = {
    nativeState: 'unknown',
    percentage: 0,
    completedResourceCount: 0,
    requiredResourceCount: 0,
  };
  let interval: ReturnType<typeof setInterval> | null = null;
  let pollInFlight = false;

  const stop = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  const poll = () => {
    if (pollInFlight) return;
    pollInFlight = true;
    void (async () => {
      try {
        if (downloadCoordinator.isStale(regionId, session)) {
          stop();
          return;
        }
        ensureMapLibreNetworkForDownload();
        const rawStatus = await pollNativePackStatus(currentPack);
        if (downloadCoordinator.isStale(regionId, session)) return;
        lastDiagnostics = stallDiagnostics(rawStatus, chartStyleUri);
        if (isNativeDownloadComplete(rawStatus)) {
          stop();
          return;
        }
        const status = rawStatus ?? initializingNativePackStatus(currentPack.id);
        onStatus?.(status);
        if (rawStatus) {
          if (rawStatus.percentage > lastPercentage) {
            lastPercentage = rawStatus.percentage;
            lastAdvanceAt = Date.now();
          } else if (rawStatus.completedResourceCount > lastCompletedResources) {
            lastCompletedResources = rawStatus.completedResourceCount;
            lastAdvanceAt = Date.now();
          } else if (rawStatus.requiredResourceCount > lastRequiredResources) {
            lastRequiredResources = rawStatus.requiredResourceCount;
            lastAdvanceAt = Date.now();
          } else if (rawStatus.completedTileCount > 0) {
            lastAdvanceAt = Date.now();
          }
        }
        const now = Date.now();
        const styleReady = !chartStyleUri || isOfflineMapEngineStyleLoaded(chartStyleUri);
        if (
          !hasMeasurableDownloadProgress(status) &&
          resumeAttemptIndex < timing.resumeAtMs.length &&
          now - startedAt >= timing.resumeAtMs[resumeAttemptIndex]!
        ) {
          const usePauseCycle = PAUSE_RESUME_AT.has(resumeAttemptIndex);
          const shouldRecreate =
            onRecreatePack != null &&
            RECREATE_AT.has(resumeAttemptIndex) &&
            packRecreateCount < MAX_PACK_RECREATES &&
            styleReady &&
            status.requiredResourceCount <= 1 &&
            !recreateInFlight;
          resumeAttemptIndex += 1;
          if (shouldRecreate) {
            recreateInFlight = true;
            packRecreateCount += 1;
            if (__DEV__) {
              console.info('[downloadStallWatchdog] recreating native pack — enumeration stuck', {
                regionId,
                packId: currentPack.id,
                attempt: packRecreateCount,
              });
            }
            try {
              const replacement = await onRecreatePack(currentPack);
              if (replacement?.id) {
                currentPack = replacement;
                lastPercentage = 0;
                lastCompletedResources = 0;
                lastRequiredResources = 0;
                lastAdvanceAt = Date.now();
              }
            } catch {
              /* keep polling — stall timeout will surface a user-visible error */
            } finally {
              recreateInFlight = false;
            }
          } else {
            void recoverStalledPack(currentPack, usePauseCycle, chartStyleUri, viewport);
          }
        }
        const stillInitializing =
          !hasMeasurableDownloadProgress(status) && status.requiredResourceCount <= 1;
        const zeroStuck =
          !hasMeasurableDownloadProgress(status) &&
          now - startedAt >=
            (stillInitializing
              ? styleReady
                ? timing.initializingTimeoutMs
                : timing.styleEngineTimeoutMs
              : timing.zeroProgressTimeoutMs);
        const partialStuck = lastPercentage > 0 && now - lastAdvanceAt >= timing.partialStallTimeoutMs;
        if (zeroStuck || partialStuck) {
          stop();
          if (stillInitializing && !styleReady && mapEngineStallMessage) {
            onStall(mapEngineStallMessage, lastDiagnostics);
            return;
          }
          onStall(stallMessage, lastDiagnostics);
        }
      } catch {
        /* transient native read failure — keep polling */
      } finally {
        pollInFlight = false;
      }
    })();
  };

  poll();
  interval = setInterval(poll, timing.stallPollMs);

  return stop;
}
