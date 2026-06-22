import { distanceNm, bearingTrue, crossTrackErrorNm } from '../src/lib/geo/navigation';

describe('navigation geo', () => {
  const kiel: [number, number] = [10.141, 54.323];
  const fehmarn: [number, number] = [11.088, 54.439];

  it('computes rhumb distance in NM', () => {
    const nm = distanceNm(kiel, fehmarn);
    expect(nm).toBeGreaterThan(30);
    expect(nm).toBeLessThan(60);
  });

  it('computes true bearing', () => {
    const brg = bearingTrue(kiel, fehmarn);
    expect(brg).toBeGreaterThan(0);
    expect(brg).toBeLessThan(180);
  });

  it('computes cross-track error', () => {
    const xte = crossTrackErrorNm([10.2, 54.35], kiel, fehmarn);
    expect(Math.abs(xte)).toBeLessThan(20);
  });
});
