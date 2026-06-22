import { point } from '@turf/helpers';
import rhumbBearing from '@turf/rhumb-bearing';
import rhumbDistance from '@turf/rhumb-distance';
import rhumbDestination from '@turf/rhumb-destination';

const NM_PER_KM = 0.539_957;
const KM_PER_NM = 1.852;

export type LonLat = [longitude: number, latitude: number];

export function distanceNm(from: LonLat, to: LonLat): number {
  return rhumbDistance(point(from), point(to), { units: 'kilometers' }) * NM_PER_KM;
}

export function bearingTrue(from: LonLat, to: LonLat): number {
  const b = rhumbBearing(point(from), point(to));
  return ((b % 360) + 360) % 360;
}

export function destinationPoint(from: LonLat, bearingDeg: number, distanceNmValue: number): LonLat {
  const dest = rhumbDestination(point(from), distanceNmValue * KM_PER_NM, bearingDeg, { units: 'kilometers' });
  const [lon, lat] = dest.geometry.coordinates;
  return [lon, lat];
}

/** Rhumb cross-track error in NM (positive = starboard of leg). */
export function crossTrackErrorNm(position: LonLat, legStart: LonLat, legEnd: LonLat): number {
  const legBearing = bearingTrue(legStart, legEnd);
  const legLength = distanceNm(legStart, legEnd);
  if (legLength < 0.001) return distanceNm(position, legStart);
  const bearingToPos = bearingTrue(legStart, position);
  const distFromStart = distanceNm(legStart, position);
  const angleDiff = ((bearingToPos - legBearing + 540) % 360) - 180;
  return distFromStart * Math.sin((angleDiff * Math.PI) / 180);
}

export function etaUtcIso(departureMs: number, cumulativeHours: number): string {
  return new Date(departureMs + cumulativeHours * 3_600_000).toISOString();
}

export function legDurationHours(distanceNmValue: number, sogKn: number): number {
  if (sogKn <= 0) return 0;
  return distanceNmValue / sogKn;
}

export function msToKnots(speedMs: number | null | undefined): number | null {
  if (speedMs == null || Number.isNaN(speedMs)) return null;
  return speedMs * 1.943_844;
}

export function knotsToMs(kn: number): number {
  return kn / 1.943_844;
}

/** Below this SOG (kn), GPS COG is unreliable. */
export const LOW_SOG_KN = 2;
