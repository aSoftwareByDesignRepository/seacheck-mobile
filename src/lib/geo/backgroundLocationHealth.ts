type RunningListener = (running: boolean) => void;

let lastKnownRunning: boolean | null = null;
const runningListeners = new Set<RunningListener>();

/** Session-only — last observed native background task state for instant UI refresh. */
export function getLastKnownBackgroundLocationRunning(): boolean | null {
  return lastKnownRunning;
}

export function subscribeBackgroundLocationRunning(listener: RunningListener): () => void {
  runningListeners.add(listener);
  if (lastKnownRunning !== null) {
    listener(lastKnownRunning);
  }
  return () => runningListeners.delete(listener);
}

export function publishBackgroundLocationRunning(running: boolean): void {
  if (lastKnownRunning === running) return;
  lastKnownRunning = running;
  for (const listener of runningListeners) {
    listener(running);
  }
}

/** Test-only — reset cached running state between cases. */
export function resetBackgroundLocationHealthForTests(): void {
  lastKnownRunning = null;
  runningListeners.clear();
}
