import type { TrackPointRow, WaypointRow } from '../db/database';
import { nearestTrackPoint } from '../geo/nearestTrackPoint';
import { nearestWaypoint, PLANNING_WAYPOINT_PICK_RADIUS_NM, WAYPOINT_MAP_PICK_RADIUS_NM } from '../geo/nearestWaypoint';

export type MapChartTapPick =
  | { kind: 'waypoint'; waypoint: WaypointRow }
  | { kind: 'track-point'; point: TrackPointRow }
  | { kind: 'none' };

type TapPickContext = {
  savedWaypoints: WaypointRow[];
  passageWaypoints?: WaypointRow[];
  recordingTrackId: string | null;
  liveInspectPoints: TrackPointRow[];
  mapPreviewPoints: TrackPointRow[];
};

/** Synchronous chart picks — passage waypoints, saved waypoints, and track points within tap radius. */
export function pickMapChartFeatures(
  lat: number,
  lon: number,
  ctx: TapPickContext,
  pickRadiusNm = WAYPOINT_MAP_PICK_RADIUS_NM,
): MapChartTapPick {
  if (ctx.passageWaypoints?.length) {
    const passageHit = nearestWaypoint(lat, lon, ctx.passageWaypoints, pickRadiusNm);
    if (passageHit) return { kind: 'waypoint', waypoint: passageHit.waypoint };
  }

  const waypoint = nearestWaypoint(lat, lon, ctx.savedWaypoints, pickRadiusNm);
  if (waypoint) return { kind: 'waypoint', waypoint: waypoint.waypoint };

  if (ctx.recordingTrackId && ctx.liveInspectPoints.length > 0) {
    const liveHit = nearestTrackPoint(lat, lon, ctx.liveInspectPoints);
    if (liveHit) return { kind: 'track-point', point: liveHit.point };
  }

  if (ctx.mapPreviewPoints.length > 0) {
    const trackHit = nearestTrackPoint(lat, lon, ctx.mapPreviewPoints);
    if (trackHit) return { kind: 'track-point', point: trackHit.point };
  }

  return { kind: 'none' };
}

export function mapChartHasOpenDetail(input: {
  seamarkHit: unknown;
  waypointHit: unknown;
  trackPointHit: unknown;
}): boolean {
  return Boolean(input.seamarkHit ?? input.waypointHit ?? input.trackPointHit);
}

export type MapChartTapAction =
  | { action: 'open-waypoint'; waypoint: WaypointRow }
  | { action: 'open-track-point'; point: TrackPointRow }
  | { action: 'dismiss-details' }
  | { action: 'none' };

/** Short tap — pick visible features or dismiss an open detail sheet; never opens the location menu. */
export function resolveMapChartTapAction(
  lat: number,
  lon: number,
  ctx: TapPickContext,
  detailsOpen: boolean,
): MapChartTapAction {
  const pick = pickMapChartFeatures(lat, lon, ctx);
  if (pick.kind === 'waypoint') return { action: 'open-waypoint', waypoint: pick.waypoint };
  if (pick.kind === 'track-point') return { action: 'open-track-point', point: pick.point };
  if (detailsOpen) return { action: 'dismiss-details' };
  return { action: 'none' };
}

/** Passage planning tap — inspect features first; add waypoint only on empty chart. */
export function resolvePlanningMapTapAction(
  lat: number,
  lon: number,
  ctx: TapPickContext,
  detailsOpen: boolean,
  pickRadiusNm = PLANNING_WAYPOINT_PICK_RADIUS_NM,
): MapChartTapAction | { action: 'add-waypoint' } {
  const pick = pickMapChartFeatures(lat, lon, ctx, pickRadiusNm);
  if (pick.kind === 'waypoint') return { action: 'open-waypoint', waypoint: pick.waypoint };
  if (pick.kind === 'track-point') return { action: 'open-track-point', point: pick.point };
  if (detailsOpen) return { action: 'dismiss-details' };
  return { action: 'add-waypoint' };
}
