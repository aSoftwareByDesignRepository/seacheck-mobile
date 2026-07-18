import { magneticDeclinationDeg, trueToMagneticBearing } from '../src/lib/geo/magnetic';

describe('magnetic global WMM', () => {
  it('declination near Kiel is east and plausible', () => {
    const dec = magneticDeclinationDeg(54.32, 10.14);
    expect(dec).toBeGreaterThan(1);
    expect(dec).toBeLessThan(10);
  });

  it('declination in western Mediterranean differs from Baltic', () => {
    const med = magneticDeclinationDeg(43, 7);
    const baltic = magneticDeclinationDeg(54.32, 10.14);
    expect(Math.abs(med - baltic)).toBeGreaterThan(0.5);
  });

  it('declination west of UK can be west', () => {
    const dec = magneticDeclinationDeg(60, -5);
    expect(dec).toBeLessThan(0);
  });

  it('converts true to magnetic bearing', () => {
    expect(trueToMagneticBearing(90, 4)).toBeCloseTo(86, 0);
  });
});
