import {
  formatCog,
  formatCoordinates,
  formatLatitude,
  formatLongitude,
  formatSogKn,
  msToKnots,
} from '../src/map/coords';

describe('coords', () => {
  it('formats DDM near Kiel', () => {
    expect(formatCoordinates('ddm', 54.323, 10.141)).toBe("54° 19.380' N, 010° 08.460' E");
  });

  it('formats latitude and longitude helpers used by coordDisplayLayout', () => {
    expect(formatLatitude('dd', 54.323)).toBe('54.32300°');
    expect(formatLongitude('dd', 10.141)).toBe('10.14100°');
    expect(formatLatitude('ddm', 54.323)).toMatch(/N$/);
    expect(formatLongitude('ddm', 10.141)).toMatch(/E$/);
  });

  it('converts m/s to knots', () => {
    expect(msToKnots(2.572)).toBeCloseTo(5, 0);
    expect(formatSogKn(2.572)).toBe('5.0');
  });

  it('formats COG degrees', () => {
    expect(formatCog(10.4)).toBe('10°');
    expect(formatCog(null)).toBe('—');
  });
});
