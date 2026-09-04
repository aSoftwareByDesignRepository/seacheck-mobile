/** Active embedded preview slots — claimed synchronously during render before the offline host mounts. */
const activeSlots = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function hasActiveEmbeddedChartMap(): boolean {
  return activeSlots.size > 0;
}

export function subscribeEmbeddedChartMapActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Claim a GL slot for an embedded preview (call during render when the map will mount). */
export function claimEmbeddedChartMapSlot(slotId: string): void {
  if (activeSlots.has(slotId)) return;
  activeSlots.add(slotId);
  notify();
}

export function releaseEmbeddedChartMapSlot(slotId: string): void {
  if (!activeSlots.delete(slotId)) return;
  notify();
}

/** @deprecated Prefer claim/release during render — kept for tests. */
export function registerEmbeddedChartMap(): () => void {
  const slotId = `legacy-${activeSlots.size}`;
  claimEmbeddedChartMapSlot(slotId);
  return () => releaseEmbeddedChartMapSlot(slotId);
}

export function resetEmbeddedChartMapRegistryForTests(): void {
  activeSlots.clear();
  listeners.clear();
}
