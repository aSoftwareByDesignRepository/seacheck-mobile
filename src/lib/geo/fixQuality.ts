import type { LocationFix } from '../../services/locationService';

import { FIX_STALE_MS, isFixOlderThan } from './fixAge';

/** Reject fixes worse than this for anchor/MOB activation and drag evaluation. */
export const MAX_ALARM_ACCURACY_M = 75;

/** Minimum drift (nm) before SOG-only anchor drag can fire — filters GPS speed noise at anchor. */
export const ANCHOR_SOG_MIN_DRIFT_NM = 0.005;

export function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function normalizeFixTimestamp(timestamp: number | undefined | null, nowMs = Date.now()): number {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) return nowMs;
  return timestamp;
}

export function isFixAccuracyOk(fix: LocationFix | null, maxAccuracyM = MAX_ALARM_ACCURACY_M): boolean {
  if (!fix) return false;
  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM)) return true;
  return fix.accuracyM <= maxAccuracyM;
}

/** Known horizontal accuracy within limit — required for MOB / anchor activation. */
export function isSafetyAccuracyOk(fix: LocationFix | null, maxAccuracyM = MAX_ALARM_ACCURACY_M): boolean {
  if (!fix) return false;
  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM)) return false;
  return fix.accuracyM <= maxAccuracyM;
}

/** Fresh, valid coordinates with acceptable accuracy — general map/instrument quality. */
export function isFixQualityOk(fix: LocationFix | null, maxAgeMs = FIX_STALE_MS): boolean {
  if (!fix) return false;
  if (!isValidCoordinate(fix.latitude, fix.longitude)) return false;
  if (isFixOlderThan(fix, maxAgeMs)) return false;
  return isFixAccuracyOk(fix);
}

/** Fresh fix with known accuracy — required before MOB drop and anchor-at-current-position. */
export function isSafetyFixOk(fix: LocationFix | null, maxAgeMs = FIX_STALE_MS): boolean {
  if (!fix) return false;
  if (!isValidCoordinate(fix.latitude, fix.longitude)) return false;
  if (isFixOlderThan(fix, maxAgeMs)) return false;
  return isSafetyAccuracyOk(fix);
}
