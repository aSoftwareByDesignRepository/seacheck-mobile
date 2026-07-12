import { fixAgeSeconds, isFixOlderThan, FIX_AGING_MS, FIX_STALE_MS } from '../src/lib/geo/fixAge';
import { computeLeeway, leewayDeg, resolveLeewayDisplay } from '../src/lib/geo/leeway';

describe('fix age', () => {
  const fix = {
    latitude: 54,
    longitude: 10,
    heading: 90,
    cogDeg: 100,
    speedMs: 2,
    speedKn: 4,
    accuracyM: 5,
    altitudeM: null,
    timestamp: Date.now() - 15_000,
  };

  it('computes age in seconds', () => {
    expect(fixAgeSeconds(fix, fix.timestamp + 15_000)).toBe(15);
  });

  it('flags aging and stale thresholds', () => {
    expect(isFixOlderThan(fix, FIX_AGING_MS)).toBe(true);
    expect(isFixOlderThan(fix, FIX_STALE_MS)).toBe(false);
  });
});

describe('leeway', () => {
  it('computes signed angle from heading to COG', () => {
    expect(leewayDeg(90, 100)).toBeCloseTo(10, 0);
    expect(leewayDeg(90, 80)).toBeCloseTo(-10, 0);
  });

  it('returns null below SOG threshold', () => {
    expect(computeLeeway(1, 90, 100)).toBeNull();
  });

  it('labels starboard drift', () => {
    const result = computeLeeway(5, 90, 110);
    expect(result?.side).toBe('starboard');
  });
});

describe('resolveLeewayDisplay', () => {
  it('hides leeway when user setting is off', () => {
    expect(
      resolveLeewayDisplay({
        mapShowLeeway: false,
        stale: false,
        sogKn: 5,
        headingDeg: 90,
        cogDeg: 110,
      }),
    ).toEqual({ showLeeway: false, leeway: null });
  });

  it('hides leeway on stale fix even when setting is on', () => {
    expect(
      resolveLeewayDisplay({
        mapShowLeeway: true,
        stale: true,
        sogKn: 5,
        headingDeg: 90,
        cogDeg: 110,
      }),
    ).toEqual({ showLeeway: false, leeway: null });
  });

  it('shows leeway when setting is on and GPS data is valid', () => {
    const result = resolveLeewayDisplay({
      mapShowLeeway: true,
      stale: false,
      sogKn: 5,
      headingDeg: 90,
      cogDeg: 110,
    });
    expect(result.showLeeway).toBe(true);
    expect(result.leeway?.side).toBe('starboard');
  });

  it('hides leeway below SOG threshold', () => {
    expect(
      resolveLeewayDisplay({
        mapShowLeeway: true,
        stale: false,
        sogKn: 1,
        headingDeg: 90,
        cogDeg: 110,
      }).showLeeway,
    ).toBe(false);
  });

  it('hides leeway without heading', () => {
    expect(
      resolveLeewayDisplay({
        mapShowLeeway: true,
        stale: false,
        sogKn: 5,
        headingDeg: null,
        cogDeg: 110,
      }).showLeeway,
    ).toBe(false);
  });
});
