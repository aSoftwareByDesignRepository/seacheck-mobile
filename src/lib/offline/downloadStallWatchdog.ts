import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { downloadCoordinator } from './downloadCoordinator';
import { hasMeasurableDownloadProgress } from './nativePackProgress';
import { warmupOfflineEngine } from './warmupOfflineEngine';

const STALL_POLL_MS = 5_000;
const ZERO_PROGRESS_TIMEOUT_MS = 120_000;
const INITIALIZING_TIMEOUT_MS = 180_000;
const PARTIAL_STALL_TIMEOUT_MS = 3 * 60_000;
/** Resume retries while stuck at 0% — spaced to recover from transient network gates. */
const RESUME_AT_MS = [8_000, 20_000, 45_000, 75_000, 105_000] as const;
/** Attempt pause → warmup → resume on these resume indices (0-based, after threshold crossed). */
const PAUSE_RESUME_AT = new Set([1, 3]);

export type StallDiagnostics = {
  nativeState: string;
  percentage: number;
  completedResourceCount: number;
  requiredResourceCount: number;
};

function isNativeDownloadComplete(status: OfflinePackStatus): boolean {
  const nominallyComplete = status.state === 'complete' || status.percentage >= 100;
  if (!nominallyComplete) return false;
  if (status.requiredResourceCount <= 0) return false;
  return status.completedResourceCount >= status.requiredResourceCount;
}

function stallDiagnostics(status: OfflinePackStatus): StallDiagnostics {
  return {
    nativeState: status.state,
    percentage: status.percentage,
    completedResourceCount: status.completedResourceCount,
    requiredResourceCount: status.requiredResourceCount,
  };
}

async function recoverStalledPack(pack: OfflinePack, usePauseCycle: boolean): Promise<void> {
  ensureMapLibreNetworkForDownload();
  try {
    await warmupOfflineEngine();
  } catch {
    /* best effort */
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

  const stop = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  const poll = () => {
    void (async () => {
      if (downloadCoordinator.isStale(regionId, session)) {
        stop();
        return;
      }
      ensureMapLibreNetworkForDownload();
      try {
        const status = await pack.status();
        if (downloadCoordinator.isStale(regionId, session)) return;
        lastDiagnostics = stallDiagnostics(status);
        if (isNativeDownloadComplete(status)) {
          stop();
          return;
        }
        onStatus?.(status);
        if (status.percentage > lastPercentage) {
          lastPercentage = status.percentage;
          lastAdvanceAt = Date.now();
        } else if (status.completedResourceCount > lastCompletedResources) {
          lastCompletedResources = status.completedResourceCount;
          lastAdvanceAt = Date.now();
        } else if (status.requiredResourceCount > lastRequiredResources) {
          lastRequiredResources = status.requiredResourceCount;
          lastAdvanceAt = Date.now();
        }
        const now = Date.now();
        if (
          !hasMeasurableDownloadProgress(status) &&
          resumeAttemptIndex < RESUME_AT_MS.length &&
          now - startedAt >= RESUME_AT_MS[resumeAttemptIndex]!
        ) {
          const usePauseCycle = PAUSE_RESUME_AT.has(resumeAttemptIndex);
          resumeAttemptIndex += 1;
          await recoverStalledPack(pack, usePauseCycle);
        }
        const stillInitializing =
          !hasMeasurableDownloadProgress(status) && status.requiredResourceCount <= 1;
        const zeroStuck =
          !hasMeasurableDownloadProgress(status) &&
          now - startedAt >= (stillInitializing ? INITIALIZING_TIMEOUT_MS : ZERO_PROGRESS_TIMEOUT_MS);
        const partialStuck = lastPercentage > 0 && now - lastAdvanceAt >= PARTIAL_STALL_TIMEOUT_MS;
        if (zeroStuck || partialStuck) {
          stop();
          onStall(stallMessage, lastDiagnostics);
        }
      } catch {
        /* transient native read failure — keep polling */
      }
    })();
  };

  poll();
  interval = setInterval(poll, STALL_POLL_MS);

  return stop;
}
