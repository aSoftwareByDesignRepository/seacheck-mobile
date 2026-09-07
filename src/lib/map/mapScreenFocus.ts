/** Session-only — whether the Map tab is currently focused (not persisted). */
let mapScreenFocused = false;
const listeners = new Set<() => void>();

export function setMapScreenFocused(focused: boolean): void {
  if (mapScreenFocused === focused) return;
  mapScreenFocused = focused;
  for (const listener of listeners) listener();
}

export function isMapScreenFocused(): boolean {
  return mapScreenFocused;
}

export function subscribeMapScreenFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Block until the Map tab is focused (TextureView must be on-screen to paint).
 * Call after navigateToMapForChartDownload().
 */
export async function waitForMapScreenFocused(timeoutMs = 20_000): Promise<boolean> {
  if (mapScreenFocused) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(mapScreenFocused);
    }, timeoutMs);
    const unsub = subscribeMapScreenFocus(() => {
      if (mapScreenFocused) {
        clearTimeout(timer);
        unsub();
        resolve(true);
      }
    });
  });
}

/** Test-only reset. */
export function resetMapScreenFocusForTests(): void {
  mapScreenFocused = false;
  listeners.clear();
}
