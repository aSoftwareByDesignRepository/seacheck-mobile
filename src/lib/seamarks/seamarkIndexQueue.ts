import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import NetInfo from '@react-native-community/netinfo';

import { fetchIsEffectivelyOnline, isEffectivelyOnline } from '../network/connectivity';

type QueueEntry = {
  bounds: LngLatBounds;
  attempts: number;
  nextAtMs: number;
};

type SeamarkIndexExecutor = (regionId: string, bounds: LngLatBounds) => Promise<void>;

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

const pending = new Map<string, QueueEntry>();
let executor: SeamarkIndexExecutor | null = null;
let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let netUnsub: (() => void) | null = null;
let drainChain: Promise<void> = Promise.resolve();

function scheduleDrain(): void {
  drainChain = drainChain.then(() => drainSeamarkIndexQueue()).catch(() => {});
}

function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

function scheduleRetryDelay(ms: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduleDrain();
  }, ms);
}

export function registerSeamarkIndexExecutor(fn: SeamarkIndexExecutor): void {
  executor = fn;
}

/** Queue seamark bulk indexing for a ready offline pack. */
export function enqueueSeamarkIndex(regionId: string, bounds: LngLatBounds, immediate = true): void {
  const existing = pending.get(regionId);
  if (existing) {
    existing.bounds = bounds;
    if (immediate) existing.nextAtMs = 0;
    scheduleDrain();
    return;
  }
  pending.set(regionId, { bounds, attempts: 0, nextAtMs: immediate ? 0 : Date.now() + BASE_BACKOFF_MS });
  scheduleDrain();
}

export function cancelSeamarkIndex(regionId: string): void {
  pending.delete(regionId);
}

export function hasPendingSeamarkIndex(regionId: string): boolean {
  return pending.has(regionId);
}

export function pendingSeamarkIndexCount(): number {
  return pending.size;
}

/** Subscribe to connectivity — retries queued indexing when back online. */
export function ensureSeamarkIndexQueueListening(): void {
  if (netUnsub) return;
  netUnsub = NetInfo.addEventListener((state) => {
    if (isEffectivelyOnline(state)) scheduleDrain();
  });
}

export async function drainSeamarkIndexQueue(): Promise<void> {
  if (draining || !executor || pending.size === 0) return;
  if (!(await fetchIsEffectivelyOnline())) return;

  draining = true;
  let nextRetryMs: number | null = null;

  try {
    while (pending.size > 0) {
      const now = Date.now();
      const ready = [...pending.entries()]
        .filter(([, entry]) => entry.nextAtMs <= now)
        .sort((a, b) => a[1].nextAtMs - b[1].nextAtMs);

      if (ready.length === 0) {
        const soonest = Math.min(...[...pending.values()].map((e) => e.nextAtMs));
        nextRetryMs = Math.max(0, soonest - now);
        break;
      }

      if (!(await fetchIsEffectivelyOnline())) break;

      const [regionId, entry] = ready[0]!;
      try {
        await executor(regionId, entry.bounds);
        pending.delete(regionId);
      } catch {
        entry.attempts += 1;
        if (entry.attempts >= MAX_ATTEMPTS) {
          pending.delete(regionId);
          continue;
        }
        entry.nextAtMs = Date.now() + backoffMs(entry.attempts);
        nextRetryMs = Math.min(nextRetryMs ?? entry.nextAtMs - Date.now(), entry.nextAtMs - Date.now());
        break;
      }
    }

    if (pending.size > 0) {
      const now = Date.now();
      const delay =
        nextRetryMs ??
        Math.max(0, Math.min(...[...pending.values()].map((e) => Math.max(0, e.nextAtMs - now))));
      if (delay > 0) scheduleRetryDelay(delay);
      else scheduleDrain();
    }
  } finally {
    draining = false;
  }
}

/** Await all scheduled drain work — test helper. */
export async function flushSeamarkIndexQueueForTests(): Promise<void> {
  await drainChain;
  await drainSeamarkIndexQueue();
}

/** Test-only reset. */
export function resetSeamarkIndexQueueForTests(): void {
  pending.clear();
  draining = false;
  drainChain = Promise.resolve();
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (netUnsub) {
    netUnsub();
    netUnsub = null;
  }
}
