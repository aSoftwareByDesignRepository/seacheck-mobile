import { formatSog, sogFromMs, distanceFromNm, formatDistanceNm, avgSpeedFromSession } from '../src/lib/geo/units';

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

  it('computes average speed from session distance and elapsed time', () => {
    expect(avgSpeedFromSession(1, 3_600_000, 'kn')).toBe('1.0');
    expect(avgSpeedFromSession(0, 3_600_000, 'kn')).toBe('—');
  });
});
