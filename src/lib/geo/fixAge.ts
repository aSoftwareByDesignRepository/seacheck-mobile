import type { LocationFix } from '../../services/locationService';

/** Amber warning threshold (plan §19.5). */
export const FIX_AGING_MS = 10_000;

/** Instruments show stale values above this age. */
export const FIX_STALE_MS = 30_000;

export function fixAgeSeconds(fix: LocationFix | null, nowMs = Date.now()): number | null {
  if (!fix) return null;
  return Math.max(0, Math.floor((nowMs - fix.timestamp) / 1000));
}

export function isFixOlderThan(fix: LocationFix | null, maxAgeMs: number): boolean {
  if (!fix) return true;
  return Date.now() - fix.timestamp > maxAgeMs;
}
