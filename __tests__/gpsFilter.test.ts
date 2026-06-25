import {
  buildDisplayFix,
  classifyFixAcceptance,
  isFixOutlier,
  smoothGpsPosition,
  estimateSmoothedAccuracyM,
} from '../src/lib/geo/gpsFilter';
import type { LocationFix } from '../src/services/locationService';

describe('gpsFilter', () => {
  const base = (overrides: Partial<LocationFix> = {}): LocationFix => ({
    latitude: 54.32,
    longitude: 10.12,
    heading: null,
    cogDeg: null,
    speedMs: 0,
    speedKn: 5,
    accuracyM: 8,
    altitudeM: null,
    timestamp: 1_700_000_000_000,
    ...overrides,
  });

  it('accepts a fresh accurate fix', () => {
    expect(classifyFixAcceptance(null, base()).accepted).toBe(true);
  });

  it('rejects poor accuracy fixes', () => {
    const result = classifyFixAcceptance(null, base({ accuracyM: 120 }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('poor_accuracy');
  });

  it('rejects impossible jumps as outliers', () => {
    const prev = base({ timestamp: 1_700_000_000_000, speedKn: 5 });
    const next = base({
      latitude: 54.5,
      longitude: 10.12,
      timestamp: 1_700_000_001_000,
      speedKn: 5,
    });
    expect(isFixOutlier(prev, next)).toBe(true);
    expect(classifyFixAcceptance(prev, next).reason).toBe('outlier');
  });

  it('allows normal movement at cruising speed', () => {
    const prev = base({ timestamp: 1_700_000_000_000, speedKn: 6 });
    const next = base({
      latitude: 54.3201,
      longitude: 10.12,
      timestamp: 1_700_000_002_000,
      speedKn: 6,
    });
    expect(isFixOutlier(prev, next)).toBe(false);
    expect(classifyFixAcceptance(prev, next).accepted).toBe(true);
  });

  it('smooths position toward higher-accuracy fixes', () => {
    const rough = base({ latitude: 54.32, longitude: 10.12, accuracyM: 40 });
    const precise = base({ latitude: 54.321, longitude: 10.121, accuracyM: 6, timestamp: rough.timestamp + 1000 });

    const s1 = smoothGpsPosition(null, rough);
    const s2 = smoothGpsPosition(s1, precise);
    expect(s2.latitude).toBeGreaterThan(54.32);
    expect(s2.latitude).toBeLessThan(54.321);
    expect(s2.longitude).toBeGreaterThan(10.12);
  });

  it('builds display fix with smoothed coordinates', () => {
    const fix = base({ accuracyM: 10 });
    const smooth = smoothGpsPosition(null, fix);
    const display = buildDisplayFix(fix, smooth, true);
    expect(display.latitude).toBe(fix.latitude);
    expect(estimateSmoothedAccuracyM(smooth, 10)).toBeLessThanOrEqual(10);
  });
});
