import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { downloadCoordinator } from './downloadCoordinator';
import { isOfflineMapEngineStyleLoaded, requestOfflineMapEngineStyleReload } from './offlineMapEngineHost';
import { hasMeasurableDownloadProgress } from './nativePackProgress';
import { initializingNativePackStatus, pollNativePackStatus } from './nativePackStatus';
import { warmupOfflineEngine } from './warmupOfflineEngine';
import { yieldToUi } from '../async/yieldToUi';

const STALL_POLL_MS = 3_000;
const ZERO_PROGRESS_TIMEOUT_MS = 120_000;
const INITIALIZING_TIMEOUT_MS = 180_000;
const STYLE_ENGINE_TIMEOUT_MS = 240_000;
const PARTIAL_STALL_TIMEOUT_MS = 3 * 60_000;
/** Resume retries while stuck at 0% — spaced to recover from transient network gates. */
const RESUME_AT_MS = [3_000, 8_000, 20_000, 45_000, 75_000, 105_000] as const;
/** Attempt pause → warmup → resume on these resume indices (0-based, after threshold crossed). */
const PAUSE_RESUME_AT = new Set([1, 3]);

export type StallDiagnostics = {
  nativeState: string;
  percentage: number;
  completedResourceCount: number;
  requiredResourceCount: number;
  mapEngineStyleLoaded?: boolean;
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

async function recoverStalledPack(
  pack: OfflinePack,
  usePauseCycle: boolean,
  chartStyleUri?: string,
): Promise<void> {
  ensureMapLibreNetworkForDownload();
  if (chartStyleUri && !isOfflineMapEngineStyleLoaded(chartStyleUri)) {
    requestOfflineMapEngineStyleReload();
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
  chartStyleUri?: string,
  mapEngineStallMessage?: string,
): () => void {
  const startedAt = Date.now();
  let lastPercentage = 0;
  let lastCompletedResources = 0;
  let lastRequiredResources = 0;
  let lastAdvanceAt = startedAt;
  let resumeAttemptIndex = 0;
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
        const rawStatus = await pollNativePackStatus(pack);
        if (downloadCoordinator.isStale(regionId, session)) return;
        lastDiagnostics = stallDiagnostics(rawStatus, chartStyleUri);
        if (isNativeDownloadComplete(rawStatus)) {
          stop();
          return;
        }
        const status = rawStatus ?? initializingNativePackStatus(pack.id);
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
          }
        }
        const now = Date.now();
        const styleReady = !chartStyleUri || isOfflineMapEngineStyleLoaded(chartStyleUri);
        if (
          !hasMeasurableDownloadProgress(status) &&
          resumeAttemptIndex < RESUME_AT_MS.length &&
          now - startedAt >= RESUME_AT_MS[resumeAttemptIndex]!
        ) {
          const usePauseCycle = PAUSE_RESUME_AT.has(resumeAttemptIndex);
          resumeAttemptIndex += 1;
          void recoverStalledPack(pack, usePauseCycle, chartStyleUri);
        }
        const stillInitializing =
          !hasMeasurableDownloadProgress(status) && status.requiredResourceCount <= 1;
        const zeroStuck =
          !hasMeasurableDownloadProgress(status) &&
          now - startedAt >=
            (stillInitializing
              ? styleReady
                ? INITIALIZING_TIMEOUT_MS
                : STYLE_ENGINE_TIMEOUT_MS
              : ZERO_PROGRESS_TIMEOUT_MS);
        const partialStuck = lastPercentage > 0 && now - lastAdvanceAt >= PARTIAL_STALL_TIMEOUT_MS;
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
  interval = setInterval(poll, STALL_POLL_MS);

  return stop;
}
