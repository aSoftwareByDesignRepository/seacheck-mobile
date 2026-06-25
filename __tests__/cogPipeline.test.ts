import { computeGpsCogDeg, resolveDisplayCog } from '../src/lib/geo/cog';
import { LOW_SOG_KN } from '../src/lib/geo/navigation';

describe('GPS COG pipeline', () => {
  const t0 = 1_700_000_000_000;

  it('derives COG from successive positions', () => {
    const prev = { latitude: 54.0, longitude: 10.0, timestamp: t0 };
    const current = { latitude: 54.01, longitude: 10.0, timestamp: t0 + 1000 };
    const cog = computeGpsCogDeg(prev, current);
    expect(cog).not.toBeNull();
    expect(cog!).toBeGreaterThanOrEqual(0);
    expect(cog!).toBeLessThan(360);
  });

  it('returns null for negligible movement', () => {
    const prev = { latitude: 54.0, longitude: 10.0, timestamp: t0 };
    const current = { latitude: 54.000001, longitude: 10.0, timestamp: t0 + 1000 };
    expect(computeGpsCogDeg(prev, current)).toBeNull();
  });

  it('uses GPS COG when SOG is above threshold', () => {
    const fix = {
      latitude: 54,
      longitude: 10,
      heading: 90,
      speedKn: LOW_SOG_KN + 1,
      cogDeg: 270,
      timestamp: t0,
    };
    expect(resolveDisplayCog(fix)).toBe(270);
  });

  it('prefers heading below LOW SOG threshold', () => {
    const fix = {
      latitude: 54,
      longitude: 10,
      heading: 45,
      speedKn: 0.5,
      cogDeg: 270,
      timestamp: t0,
    };
    expect(resolveDisplayCog(fix)).toBe(45);
  });

  it('returns null below LOW SOG without heading', () => {
    const fix = {
      latitude: 54,
      longitude: 10,
      heading: null,
      speedKn: 0.5,
      cogDeg: null,
      timestamp: t0,
    };
    expect(resolveDisplayCog(fix)).toBeNull();
  });
});
