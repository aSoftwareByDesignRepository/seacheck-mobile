import { computeBarometerTrend, pruneBarometerReadings } from '../src/lib/barometer/trend';
import { formatLegElapsed } from '../src/lib/racing/legTimer';

describe('formatLegElapsed', () => {
  it('formats sub-hour legs as M:SS', () => {
    expect(formatLegElapsed(134_000)).toBe('2:14');
  });

  it('formats hour-plus legs as H:MM:SS', () => {
    expect(formatLegElapsed(3_725_000)).toBe('1:02:05');
  });
});

describe('barometer trend', () => {
  const now = Date.parse('2026-06-22T12:00:00.000Z');

  it('detects falling fast pressure over 3h', () => {
    const readings = pruneBarometerReadings(
      [
        { ts: now - 3 * 60 * 60 * 1000, hPa: 1016 },
        { ts: now - 60 * 60 * 1000, hPa: 1013 },
        { ts: now, hPa: 1012 },
      ],
      now,
    );
    const trend = computeBarometerTrend(readings, now);
    expect(trend.trend).toBe('falling_fast');
    expect(trend.delta3h).toBeLessThanOrEqual(-3);
  });

  it('prunes readings older than 3 hours', () => {
    const pruned = pruneBarometerReadings(
      [
        { ts: now - 4 * 60 * 60 * 1000, hPa: 1020 },
        { ts: now - 2 * 60 * 60 * 1000, hPa: 1015 },
      ],
      now,
    );
    expect(pruned).toHaveLength(1);
  });
});
