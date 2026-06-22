import * as geomag from 'geomag';

/**
 * Magnetic declination (° east positive) via World Magnetic Model (geomag / WMM2020).
 * Valid globally for navigation-aid use; replace coefficients when WMM2025 ships in geomag.
 */

export function magneticDeclinationDeg(lat: number, lon: number, altM = 0, _date = new Date()): number {
  void _date;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 0;
  try {
    const field = geomag.field(lat, lon, altM / 1000);
    const dec = field.declination;
    if (!Number.isFinite(dec)) return 0;
    return dec;
  } catch {
    return 0;
  }
}

export function trueToMagneticBearing(trueDeg: number, declinationEastDeg: number): number {
  return ((trueDeg - declinationEastDeg) % 360 + 360) % 360;
}

export function magneticToTrueBearing(magneticDeg: number, declinationEastDeg: number): number {
  return ((magneticDeg + declinationEastDeg) % 360 + 360) % 360;
}

export function formatBearing(bearingDeg: number, reference: 'true' | 'magnetic', declinationEastDeg: number): {
  value: number;
  suffix: 'T' | 'M';
} {
  if (reference === 'magnetic') {
    return { value: trueToMagneticBearing(bearingDeg, declinationEastDeg), suffix: 'M' };
  }
  return { value: bearingDeg, suffix: 'T' };
}

/** Smallest signed angle from heading to target (degrees, positive = clockwise). */
export function angleDifferenceDeg(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}
