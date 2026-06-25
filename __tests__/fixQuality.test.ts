import {
  ANCHOR_SOG_MIN_DRIFT_NM,
  isFixQualityOk,
  isValidCoordinate,
  normalizeFixTimestamp,
} from '../src/lib/geo/fixQuality';
import type { LocationFix } from '../src/services/locationService';

describe('fixQuality', () => {
  const freshFix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
    latitude: 54.32,
    longitude: 10.12,
    heading: null,
    cogDeg: null,
    speedMs: 0,
    speedKn: 0,
    accuracyM: 10,
    altitudeM: null,
    timestamp: Date.now(),
    ...overrides,
  });

  it('rejects stale fixes for safety actions', () => {
    expect(isFixQualityOk(freshFix({ timestamp: Date.now() - 60_000 }))).toBe(false);
  });

  it('rejects poor accuracy fixes', () => {
    expect(isFixQualityOk(freshFix({ accuracyM: 200 }))).toBe(false);
  });

  it('accepts fresh accurate fixes', () => {
    expect(isFixQualityOk(freshFix())).toBe(true);
  });

  it('normalizes missing timestamps', () => {
    const now = 1_700_000_000_000;
    expect(normalizeFixTimestamp(undefined, now)).toBe(now);
  });

  it('validates coordinates', () => {
    expect(isValidCoordinate(54, 10)).toBe(true);
    expect(isValidCoordinate(91, 10)).toBe(false);
  });

  it('exports minimum SOG drift threshold', () => {
    expect(ANCHOR_SOG_MIN_DRIFT_NM).toBeGreaterThan(0);
  });
});
