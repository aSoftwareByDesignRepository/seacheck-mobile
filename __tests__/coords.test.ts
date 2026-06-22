import { formatCoordinates, formatSogKn, msToKnots } from '../src/map/coords';

describe('coords', () => {
  it('formats DDM near Kiel', () => {
    expect(formatCoordinates('ddm', 54.323, 10.141)).toBe("54° 19.380' N, 010° 08.460' E");
  });

  it('converts m/s to knots', () => {
    expect(msToKnots(2.572)).toBeCloseTo(5, 0);
    expect(formatSogKn(2.572)).toBe('5.0');
  });
});
