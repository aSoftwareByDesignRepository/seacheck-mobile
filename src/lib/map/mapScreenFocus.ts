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
