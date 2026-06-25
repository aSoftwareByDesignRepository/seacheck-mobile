import type { WaypointRow } from '../db/database';

import { distanceNm, type LonLat } from './navigation';

/** ~37 m at equator — tap pick radius for saved waypoints on the chart. */
export const WAYPOINT_MAP_PICK_RADIUS_NM = 0.02;

export type NearestWaypointHit = {
  waypoint: WaypointRow;
  distanceNm: number;
};

/** Returns the closest saved waypoint within pick radius, if any. */
export function nearestWaypoint(
  latitude: number,
  longitude: number,
  waypoints: WaypointRow[],
  radiusNm = WAYPOINT_MAP_PICK_RADIUS_NM,
): NearestWaypointHit | null {
  const tap: LonLat = [longitude, latitude];
  let best: NearestWaypointHit | null = null;

  for (const waypoint of waypoints) {
    const d = distanceNm(tap, [waypoint.longitude, waypoint.latitude]);
    if (d > radiusNm) continue;
    if (!best || d < best.distanceNm) {
      best = { waypoint, distanceNm: d };
    }
  }

  return best;
}
