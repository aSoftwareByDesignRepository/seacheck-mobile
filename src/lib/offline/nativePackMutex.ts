/**
 * Serializes OfflineManager createPack / deletePack / pause so cancel cannot
 * race seal recreate, and a new download cannot create while a delete is in flight.
 */

let chain: Promise<unknown> = Promise.resolve();
let pendingOps = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** True while a native pack create/delete/pause critical section is running. */
export function isNativePackOpBusy(): boolean {
  return pendingOps > 0;
}

export function subscribeNativePackOps(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetNativePackMutexForTests(): void {
  chain = Promise.resolve();
  pendingOps = 0;
}

/**
 * Run exclusive OfflineManager pack mutations. Failures still release the lock
 * so a stuck delete cannot permanently block downloads.
 */
export function withNativePackOp<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    pendingOps += 1;
    notify();
    try {
      return await fn();
    } finally {
      pendingOps -= 1;
      notify();
    }
  };
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
