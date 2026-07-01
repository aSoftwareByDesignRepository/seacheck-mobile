import { computeLiveTrailDistanceNm, computePathDistanceNm, formatGotoNavLabel, formatMapDistanceLabel, legMidpoint } from '../src/lib/geo/pathDistance';

describe('pathDistance', () => {
  it('sums rhumb distances along a path', () => {
    const total = computePathDistanceNm([
      { latitude: 54.0, longitude: 10.0 },
      { latitude: 54.1, longitude: 10.1 },
      { latitude: 54.2, longitude: 10.2 },
    ]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(30);
  });

  it('returns zero for fewer than two points', () => {
    expect(computePathDistanceNm([])).toBe(0);
    expect(computePathDistanceNm([{ latitude: 54, longitude: 10 }])).toBe(0);
    expect(computeLiveTrailDistanceNm([])).toBe(0);
    expect(computeLiveTrailDistanceNm([[10, 54]])).toBe(0);
  });

  it('computes live trail distance from lon/lat pairs', () => {
    const nm = computeLiveTrailDistanceNm([
      [10.0, 54.0],
      [10.1, 54.1],
      [10.2, 54.2],
    ]);
    expect(nm).toBeGreaterThan(0);
  });

  it('computes leg midpoint for map labels', () => {
    expect(legMidpoint({ latitude: 54, longitude: 10 }, { latitude: 56, longitude: 12 })).toEqual([11, 55]);
  });

  it('formats map distance labels with unit', () => {
    expect(formatMapDistanceLabel(10.25, 'nm')).toBe('10.3 NM');
    expect(formatMapDistanceLabel(10.25, 'km')).toMatch(/km$/);
  });

  it('formats goto nav label with bearing and distance', () => {
    expect(formatGotoNavLabel(245.4, 'T', 2.34, 'nm')).toBe('245° T · 2.3 NM');
    expect(formatGotoNavLabel(90, 'M', 1, 'km')).toMatch(/^90° M ·/);
  });
});
