import { formatSog, sogFromMs, distanceFromNm, distanceToNm, formatDistanceNm, avgSpeedFromSession, formatXteFromNm, formatXteLineFromNm, formatDistanceLineFromNm } from '../src/lib/geo/units';

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

  it('formats XTE in the user distance unit while keeping NM internally', () => {
    expect(formatXteFromNm(0.1, 'km', 'L')).toEqual({ value: '0.19', unitLabel: 'km L' });
    expect(formatXteFromNm(0.1, 'sm', 'R')).toEqual({ value: '0.12', unitLabel: 'SM R' });
    expect(formatXteFromNm(0.1, 'nm', null)).toEqual({ value: '0.10', unitLabel: 'NM' });
    expect(formatXteLineFromNm(0.1, 'km', 'L')).toBe('0.19 km L');
  });

  it('formats alarm distance lines in the user unit', () => {
    expect(formatDistanceLineFromNm(0.25, 'km')).toBe('0.46 km');
    expect(formatDistanceLineFromNm(0.25, 'nm')).toBe('0.25 NM');
  });

  it('converts user distance back to NM', () => {
    expect(distanceToNm(0.46, 'km')).toBeCloseTo(0.25, 2);
  });
});
