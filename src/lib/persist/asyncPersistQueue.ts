const chains = new Map<string, Promise<void>>();

/** Serializes AsyncStorage writes per key so concurrent mutations cannot overwrite each other. */
export function enqueuePersist(key: string, op: () => Promise<void>): Promise<void> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(op)
    .finally(() => {
      if (chains.get(key) === next) chains.delete(key);
    });
  chains.set(key, next);
  return next;
}
