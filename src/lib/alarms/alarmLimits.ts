/** Minimum cross-track / arrival alarm distance (nautical miles). */
export const ALARM_LIMIT_MIN_NM = 0.001;

/** Maximum sensible alarm distance for coastal navigation (nautical miles). */
export const ALARM_LIMIT_MAX_NM = 5;

/** Parse user-entered alarm limit; clamps to safe range or returns fallback when empty/invalid. */
export function parseAlarmLimitNm(text: string, fallback: number): number {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(ALARM_LIMIT_MAX_NM, Math.max(ALARM_LIMIT_MIN_NM, n));
}
