import type { WaypointRow } from '../db/database';

/** MOB marks from the waypoint library — shown on chart outside an active passage. */
export function mobWaypointsOnMap(waypoints: WaypointRow[]): WaypointRow[] {
  return waypoints.filter((wp) => wp.type === 'mob');
}

/** Chart picks outside passage planning: MOB marks plus waypoints on the started passage. */
export function mapTappableWaypoints(
  savedWaypoints: WaypointRow[],
  activePassageWaypoints: WaypointRow[],
): WaypointRow[] {
  const byId = new Map<string, WaypointRow>();
  for (const wp of mobWaypointsOnMap(savedWaypoints)) byId.set(wp.id, wp);
  for (const wp of activePassageWaypoints) byId.set(wp.id, wp);
  return [...byId.values()];
}
