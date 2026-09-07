/**
 * Exactly one DownloadMapEngine may mount (Android single reliable GL surface).
 *
 * The Map tab is the only sticky visible host for pack downloads. Downloads shows
 * status only — switching tabs must never remount the sweep map (that orphans the
 * controller and can seal incomplete packs).
 *
 * Corner underlay is a last-resort while Map has not claimed yet; the tile sweep
 * pauses until the visible Map slot is available.
 */

export type DownloadMapSlot = 'map' | 'downloads' | 'corner';

let mapClaim = false;
/** Map owns GL for the whole download session once claimed. */
let stickyMap = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function setDownloadMapMapClaim(active: boolean): void {
  if (mapClaim === active) return;
  mapClaim = active;
  if (active) stickyMap = true;
  notify();
}

/** @deprecated Downloads no longer hosts the sweep GL surface — kept for call-site compatibility. */
export function setDownloadMapDownloadsClaim(_active: boolean): void {
  // no-op: Map is the sole visible download host
}

export function resolveDownloadMapSlot(): DownloadMapSlot {
  if (stickyMap || mapClaim) return 'map';
  return 'corner';
}

export function isVisibleDownloadMapSlot(slot: DownloadMapSlot = resolveDownloadMapSlot()): boolean {
  return slot === 'map';
}

/** Clear sticky ownership when a download session fully ends. */
export function clearDownloadMapStickyHost(): void {
  if (!stickyMap && !mapClaim) return;
  stickyMap = false;
  mapClaim = false;
  notify();
}

/** Establish Map ownership immediately when a download session starts (before React mounts). */
export function beginDownloadMapMapOwnership(): void {
  mapClaim = true;
  stickyMap = true;
  notify();
}

export function subscribeDownloadMapSlot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function waitForVisibleDownloadMapSlot(timeoutMs = 30_000): Promise<boolean> {
  if (isVisibleDownloadMapSlot()) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(isVisibleDownloadMapSlot());
    }, timeoutMs);
    const unsub = subscribeDownloadMapSlot(() => {
      if (isVisibleDownloadMapSlot()) {
        clearTimeout(timer);
        unsub();
        resolve(true);
      }
    });
  });
}

/** Test-only reset. */
export function resetDownloadMapSlotForTests(): void {
  mapClaim = false;
  stickyMap = false;
  listeners.clear();
}

/** Test-only sticky peek. */
export function getDownloadMapStickyHostForTests(): 'map' | null {
  return stickyMap ? 'map' : null;
}
