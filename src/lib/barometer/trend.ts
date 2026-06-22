export type BarometerReading = {
  ts: number;
  hPa: number;
};

export type BarometerTrendKind = 'rising' | 'falling' | 'falling_fast' | 'steady' | 'unknown';

export type BarometerTrend = {
  currentHpa: number | null;
  delta3h: number | null;
  trend: BarometerTrendKind;
};

export const BAROMETER_HISTORY_MS = 3 * 60 * 60 * 1000;
export const BAROMETER_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

const STEADY_THRESHOLD_HPA = 1;
const FALLING_FAST_THRESHOLD_HPA = -3;

export function pruneBarometerReadings(readings: BarometerReading[], nowMs: number): BarometerReading[] {
  const cutoff = nowMs - BAROMETER_HISTORY_MS;
  return readings.filter((r) => r.ts >= cutoff).sort((a, b) => a.ts - b.ts);
}

export function computeBarometerTrend(readings: BarometerReading[], nowMs = Date.now()): BarometerTrend {
  const pruned = pruneBarometerReadings(readings, nowMs);
  if (pruned.length === 0) {
    return { currentHpa: null, delta3h: null, trend: 'unknown' };
  }
  const current = pruned[pruned.length - 1];
  const targetTs = nowMs - BAROMETER_HISTORY_MS;
  let baseline = pruned[0];
  for (const r of pruned) {
    if (r.ts <= targetTs) baseline = r;
    else break;
  }
  if (pruned.length === 1 || nowMs - baseline.ts < 15 * 60 * 1000) {
    return { currentHpa: current.hPa, delta3h: null, trend: 'unknown' };
  }
  const delta3h = current.hPa - baseline.hPa;
  let trend: BarometerTrendKind = 'steady';
  if (delta3h <= FALLING_FAST_THRESHOLD_HPA) trend = 'falling_fast';
  else if (delta3h <= -STEADY_THRESHOLD_HPA) trend = 'falling';
  else if (delta3h >= STEADY_THRESHOLD_HPA) trend = 'rising';
  return { currentHpa: current.hPa, delta3h, trend };
}
