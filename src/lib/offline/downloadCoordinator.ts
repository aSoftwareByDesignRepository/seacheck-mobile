import { promiseWithTimeout, TimeoutError } from '../async/promiseWithTimeout';
import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';

const NATIVE_PACK_LIST_TIMEOUT_MS = 8_000;

/** One active offline download at a time; stale native callbacks are ignored. */
class DownloadCoordinator {
  private activeRegionId: string | null = null;
  private preflightOnly = false;
  private sessions = new Map<string, number>();
  private activityListeners = new Set<() => void>();

  private notifyActivity(): void {
    this.activityListeners.forEach((listener) => listener());
  }

  getActiveRegionId(): string | null {
    return this.activeRegionId;
  }

  hasActiveDownload(): boolean {
    return this.activeRegionId != null;
  }

  subscribeActivity(listener: () => void): () => void {
    this.activityListeners.add(listener);
    return () => this.activityListeners.delete(listener);
  }

  /**
   * Reserve the download slot before async preflight (chart style, warmup).
   * Keeps MapLibre network enabled on Android while preflight runs.
   */
  preflightLock(regionId: string): boolean {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return false;
    this.activeRegionId = regionId;
    this.preflightOnly = true;
    ensureMapLibreNetworkForDownload();
    this.notifyActivity();
    return true;
  }

  releasePreflightLock(regionId: string): void {
    if (this.preflightOnly && this.activeRegionId === regionId) {
      this.activeRegionId = null;
      this.preflightOnly = false;
      this.notifyActivity();
    }
  }

  /** Returns session token when download may start; null when another region holds the lock. */
  tryBegin(regionId: string): number | null {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return null;
    if (this.activeRegionId === regionId && !this.preflightOnly) return null;
    this.activeRegionId = regionId;
    this.preflightOnly = false;
    ensureMapLibreNetworkForDownload();
    const next = (this.sessions.get(regionId) ?? 0) + 1;
    this.sessions.set(regionId, next);
    this.notifyActivity();
    return next;
  }

  end(regionId: string): void {
    if (this.activeRegionId === regionId) {
      this.activeRegionId = null;
      this.preflightOnly = false;
      this.notifyActivity();
    }
  }

  /** Re-lock after app restart when a native pack is still downloading. */
  restoreActive(regionId: string): boolean {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return false;
    this.activeRegionId = regionId;
    if (!this.sessions.has(regionId)) this.sessions.set(regionId, 1);
    ensureMapLibreNetworkForDownload();
    this.notifyActivity();
    return true;
  }

  sessionToken(regionId: string): number {
    return this.sessions.get(regionId) ?? 0;
  }

  /** Bump session so in-flight native callbacks are ignored (cancel / delete). */
  invalidate(regionId: string): void {
    const next = (this.sessions.get(regionId) ?? 0) + 1;
    this.sessions.set(regionId, next);
    if (this.activeRegionId === regionId) {
      this.activeRegionId = null;
      this.preflightOnly = false;
    }
    this.notifyActivity();
  }

  isStale(regionId: string, token: number): boolean {
    return this.sessions.get(regionId) !== token;
  }

  /** Test-only — clears locks and session tokens. */
  resetForTests(): void {
    this.activeRegionId = null;
    this.preflightOnly = false;
    this.sessions.clear();
    this.activityListeners.clear();
  }
}

export const downloadCoordinator = new DownloadCoordinator();

/** Subscribe to download lock changes (preflight, start, end, cancel). */
export function subscribeDownloadCoordinatorActivity(listener: () => void): () => void {
  return downloadCoordinator.subscribeActivity(listener);
}

/** Test-only — clears active download lock. */
export function resetDownloadCoordinatorForTests(): void {
  downloadCoordinator.resetForTests();
}

export function formatDownloadError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/** Retry native pack listing — transient failures should not mark packs missing. */
export async function loadNativePacksWithRetry(
  getPacks: () => Promise<unknown[]>,
  attempts = 3,
  delayMs = 400,
  timeoutMs = NATIVE_PACK_LIST_TIMEOUT_MS,
): Promise<{ packs: unknown[]; ok: boolean }> {
  let last: unknown[] = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const packs = await promiseWithTimeout(getPacks(), timeoutMs, 'OfflineManager.getPacks');
      return { packs, ok: true };
    } catch (error) {
      if (error instanceof TimeoutError) {
        console.warn('[downloadCoordinator] native pack listing timed out');
      }
      last = [];
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return { packs: last, ok: false };
}
