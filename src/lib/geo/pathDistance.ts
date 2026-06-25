import type { DistanceUnit } from '../../settings/defaults';
import { distanceUnitLabel, formatDistanceNm } from './units';
import { distanceNm, type LonLat } from './navigation';

export type LatLon = { latitude: number; longitude: number };

export function toLonLat(point: LatLon): LonLat {
  return [point.longitude, point.latitude];
}

/** Rhumb-line distance along a path of GPS/chart points (nautical miles). */
export function computePathDistanceNm(points: readonly LatLon[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceNm(toLonLat(points[i - 1]!), toLonLat(points[i]!));
  }
  return total;
}

export function legMidpoint(from: LatLon, to: LatLon): LonLat {
  return [(from.longitude + to.longitude) / 2, (from.latitude + to.latitude) / 2];
}

/** Compact chart label — e.g. "12.4 NM". */
export function formatMapDistanceLabel(distanceNmValue: number, unit: DistanceUnit, digits = 1): string {
  return `${formatDistanceNm(distanceNmValue, unit, digits)} ${distanceUnitLabel(unit)}`;
}

/** Midpoint label on the goto line — bearing and distance from current position. */
export function formatGotoNavLabel(
  bearingDeg: number,
  bearingSuffix: 'T' | 'M',
  distanceNmValue: number,
  unit: DistanceUnit,
): string {
  return `${Math.round(bearingDeg)}° ${bearingSuffix} · ${formatMapDistanceLabel(distanceNmValue, unit)}`;
}
