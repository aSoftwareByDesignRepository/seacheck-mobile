import { formatSog, sogFromMs, distanceFromNm, formatDistanceNm } from '../src/lib/geo/units';
import { magneticDeclinationDeg, trueToMagneticBearing } from '../src/lib/geo/magnetic';

describe('units', () => {
  it('converts SOG to knots', () => {
    expect(formatSog(2.572, 'kn')).toBe('5.0');
  });

  it('converts SOG to km/h', () => {
    expect(sogFromMs(2.572, 'kmh')).toBeCloseTo(9.26, 1);
  });

  it('formats distance in km', () => {
    expect(formatDistanceNm(1, 'km')).toBe('1.9');
    expect(distanceFromNm(10, 'nm')).toBe(10);
  });
});

describe('magnetic', () => {
  it('declination near Kiel is east and plausible', () => {
    const dec = magneticDeclinationDeg(54.32, 10.14);
    expect(dec).toBeGreaterThan(0);
    expect(dec).toBeGreaterThan(1);
    expect(dec).toBeLessThan(10);
  });

  it('converts true to magnetic bearing', () => {
    const mag = trueToMagneticBearing(90, 4);
    expect(mag).toBeCloseTo(86, 0);
  });
});
