import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';

/** One active offline download at a time; stale native callbacks are ignored. */
class DownloadCoordinator {
  private activeRegionId: string | null = null;
  private preflightOnly = false;
  private sessions = new Map<string, number>();

  getActiveRegionId(): string | null {
    return this.activeRegionId;
  }

  hasActiveDownload(): boolean {
    return this.activeRegionId != null;
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
    return true;
  }

  releasePreflightLock(regionId: string): void {
    if (this.preflightOnly && this.activeRegionId === regionId) {
      this.activeRegionId = null;
      this.preflightOnly = false;
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
    return next;
  }

  end(regionId: string): void {
    if (this.activeRegionId === regionId) {
      this.activeRegionId = null;
      this.preflightOnly = false;
    }
  }

  /** Re-lock after app restart when a native pack is still downloading. */
  restoreActive(regionId: string): boolean {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return false;
    this.activeRegionId = regionId;
    if (!this.sessions.has(regionId)) this.sessions.set(regionId, 1);
    ensureMapLibreNetworkForDownload();
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
  }

  isStale(regionId: string, token: number): boolean {
    return this.sessions.get(regionId) !== token;
  }

  /** Test-only — clears locks and session tokens. */
  resetForTests(): void {
    this.activeRegionId = null;
    this.preflightOnly = false;
    this.sessions.clear();
  }
}

export const downloadCoordinator = new DownloadCoordinator();

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
): Promise<{ packs: unknown[]; ok: boolean }> {
  let last: unknown[] = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const packs = await getPacks();
      return { packs, ok: true };
    } catch {
      last = [];
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return { packs: last, ok: false };
}
