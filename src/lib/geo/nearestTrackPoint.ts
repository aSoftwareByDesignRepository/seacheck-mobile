import type { TrackPointRow } from '../db/database';

import { crossTrackErrorNm, distanceNm, type LonLat } from './navigation';

/** ~37 m — same pick radius as waypoint map taps. */
export const TRACK_MAP_PICK_RADIUS_NM = 0.02;

export type NearestTrackPointHit = {
  point: TrackPointRow;
  distanceNm: number;
};

/**
 * Returns the closest track fix within pick radius.
 * Checks vertices and line segments so taps on the track line hit the nearest fix.
 */
export function nearestTrackPoint(
  latitude: number,
  longitude: number,
  points: TrackPointRow[],
  radiusNm = TRACK_MAP_PICK_RADIUS_NM,
): NearestTrackPointHit | null {
  if (points.length === 0) return null;

  const tap: LonLat = [longitude, latitude];
  let best: NearestTrackPointHit | null = null;

  const consider = (point: TrackPointRow, d: number) => {
    if (d > radiusNm) return;
    if (!best || d < best.distanceNm) {
      best = { point, distanceNm: d };
    }
  };

  for (const point of points) {
    consider(point, distanceNm(tap, [point.longitude, point.latitude]));
  }

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const aLonLat: LonLat = [a.longitude, a.latitude];
    const bLonLat: LonLat = [b.longitude, b.latitude];
    const ab = distanceNm(aLonLat, bLonLat);
    const da = distanceNm(tap, aLonLat);
    const db = distanceNm(tap, bLonLat);
    const xte = Math.abs(crossTrackErrorNm(tap, aLonLat, bLonLat));

    if (xte <= radiusNm && da <= ab + radiusNm && db <= ab + radiusNm) {
      consider(da <= db ? a : b, Math.min(da, db));
    }
  }

  return best;
}
