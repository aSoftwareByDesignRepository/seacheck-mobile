/** One active offline download at a time; stale native callbacks are ignored. */
class DownloadCoordinator {
  private activeRegionId: string | null = null;
  private sessions = new Map<string, number>();

  getActiveRegionId(): string | null {
    return this.activeRegionId;
  }

  /** Returns session token when download may start; null when another download is active. */
  tryBegin(regionId: string): number | null {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return null;
    this.activeRegionId = regionId;
    const next = (this.sessions.get(regionId) ?? 0) + 1;
    this.sessions.set(regionId, next);
    return next;
  }

  end(regionId: string): void {
    if (this.activeRegionId === regionId) this.activeRegionId = null;
  }

  /** Re-lock after app restart when a native pack is still downloading. */
  restoreActive(regionId: string): boolean {
    if (this.activeRegionId != null && this.activeRegionId !== regionId) return false;
    this.activeRegionId = regionId;
    if (!this.sessions.has(regionId)) this.sessions.set(regionId, 1);
    return true;
  }

  sessionToken(regionId: string): number {
    return this.sessions.get(regionId) ?? 0;
  }

  /** Bump session so in-flight native callbacks are ignored (cancel / delete). */
  invalidate(regionId: string): void {
    const next = (this.sessions.get(regionId) ?? 0) + 1;
    this.sessions.set(regionId, next);
    if (this.activeRegionId === regionId) this.activeRegionId = null;
  }

  isStale(regionId: string, token: number): boolean {
    return this.sessions.get(regionId) !== token;
  }
}

export const downloadCoordinator = new DownloadCoordinator();

/** Test-only — clears active download lock. */
export function resetDownloadCoordinatorForTests(): void {
  for (const id of ['a', 'b', 'kiel-bay', 'custom_test']) {
    downloadCoordinator.invalidate(id);
  }
}

export function formatDownloadError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
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
