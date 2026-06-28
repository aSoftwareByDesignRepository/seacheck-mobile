import type { DistanceUnit } from '../../settings/defaults';
import { distanceToNm } from '../geo/units';

/** Minimum cross-track / arrival alarm distance (nautical miles). */
export const ALARM_LIMIT_MIN_NM = 0.001;

/** Maximum sensible alarm distance for coastal navigation (nautical miles). */
export const ALARM_LIMIT_MAX_NM = 5;

function clampAlarmLimitNm(nm: number): number {
  return Math.min(ALARM_LIMIT_MAX_NM, Math.max(ALARM_LIMIT_MIN_NM, nm));
}

/** Parse user-entered alarm limit in nautical miles; clamps to safe range or returns fallback when empty/invalid. */
export function parseAlarmLimitNm(text: string, fallback: number): number {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  return clampAlarmLimitNm(n);
}

/** Parse alarm limit entered in the user's display unit; stored value is always nautical miles. */
export function parseAlarmLimitDisplay(text: string, unit: DistanceUnit, fallbackNm: number): number {
  const trimmed = text.trim();
  if (!trimmed) return fallbackNm;
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(n)) return fallbackNm;
  return clampAlarmLimitNm(distanceToNm(n, unit));
}
