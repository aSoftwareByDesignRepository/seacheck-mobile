import { computeBarometerTrend, pruneBarometerReadings } from '../src/lib/barometer/trend';
import { formatLegElapsed } from '../src/lib/racing/legTimer';
import { formatCountdownMs, laylineBearingsFromMark, velocityMadeGoodKn } from '../src/lib/racing/racingGeo';
import { magneticDeclinationDeg, trueToMagneticBearing } from '../src/lib/geo/magnetic';

describe('formatLegElapsed', () => {
  it('formats sub-hour legs as M:SS', () => {
    expect(formatLegElapsed(134_000)).toBe('2:14');
  });
});

describe('barometer trend', () => {
  const now = Date.parse('2026-06-22T12:00:00.000Z');

  it('detects falling fast pressure over 3h', () => {
    const readings = pruneBarometerReadings(
      [
        { ts: now - 3 * 60 * 60 * 1000, hPa: 1016 },
        { ts: now, hPa: 1012 },
      ],
      now,
    );
    expect(computeBarometerTrend(readings, now).trend).toBe('falling_fast');
  });
});

describe('racing geo', () => {
  it('computes VMG toward mark', () => {
    expect(velocityMadeGoodKn(6, 90, 90)).toBeCloseTo(6, 1);
    expect(velocityMadeGoodKn(6, 0, 90)).toBeCloseTo(0, 1);
  });

  it('builds layline bearings from wind', () => {
    const lines = laylineBearingsFromMark(0, 45);
    expect(lines.portDeg).toBe(45);
    expect(lines.starboardDeg).toBe(315);
  });

  it('formats countdown', () => {
    expect(formatCountdownMs(125_000)).toBe('2:05');
  });
});

describe('magnetic global WMM', () => {
  it('declination near Kiel is east and plausible', () => {
    const dec = magneticDeclinationDeg(54.32, 10.14);
    expect(dec).toBeGreaterThan(1);
    expect(dec).toBeLessThan(10);
  });

  it('declination in western Mediterranean differs from Baltic', () => {
    const med = magneticDeclinationDeg(43, 7);
    const baltic = magneticDeclinationDeg(54.32, 10.14);
    expect(Math.abs(med - baltic)).toBeGreaterThan(0.5);
  });

  it('declination west of UK can be west', () => {
    const dec = magneticDeclinationDeg(60, -5);
    expect(dec).toBeLessThan(0);
  });

  it('converts true to magnetic bearing', () => {
    expect(trueToMagneticBearing(90, 4)).toBeCloseTo(86, 0);
  });
});
