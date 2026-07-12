import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { PLANNING_WAYPOINT_PICK_RADIUS_NM } from '../geo/nearestWaypoint';
import { distanceNm, type LonLat } from '../geo/navigation';
import { type LonLatPoint } from './bounds';

export const CUSTOM_DOWNLOAD_CORNER_COUNT = 4;

export type DownloadCorner = {
  id: string;
  /** 1-based display order */
  index: number;
  latitude: number;
  longitude: number;
};

/** Axis-aligned bounds enclosing all corner points (needs ≥2 points). */
export function boundsFromPoints(points: LonLatPoint[]): LngLatBounds | null {
  if (points.length < 2) return null;
  let west = points[0].longitude;
  let south = points[0].latitude;
  let east = points[0].longitude;
  let north = points[0].latitude;
  for (const p of points) {
    west = Math.min(west, p.longitude);
    south = Math.min(south, p.latitude);
    east = Math.max(east, p.longitude);
    north = Math.max(north, p.latitude);
  }
  return [west, south, east, north];
}

/** Clockwise rectangle corners from bounds: SW → SE → NE → NW. */
export function rectangleCornersFromBounds(bounds: LngLatBounds): LonLatPoint[] {
  const [west, south, east, north] = bounds;
  return [
    { latitude: south, longitude: west },
    { latitude: south, longitude: east },
    { latitude: north, longitude: east },
    { latitude: north, longitude: west },
  ];
}

export function nearestDownloadCorner(
  latitude: number,
  longitude: number,
  corners: DownloadCorner[],
  radiusNm = PLANNING_WAYPOINT_PICK_RADIUS_NM,
): DownloadCorner | null {
  const tap: LonLat = [longitude, latitude];
  let best: { corner: DownloadCorner; distanceNm: number } | null = null;
  for (const corner of corners) {
    const d = distanceNm(tap, [corner.longitude, corner.latitude]);
    if (d > radiusNm) continue;
    if (!best || d < best.distanceNm) {
      best = { corner, distanceNm: d };
    }
  }
  return best?.corner ?? null;
}

export function reindexDownloadCorners(corners: DownloadCorner[]): DownloadCorner[] {
  return corners.map((corner, i) => ({ ...corner, index: i + 1 }));
}

export function createDownloadCorner(point: LonLatPoint, index: number): DownloadCorner {
  return {
    id: `dl_${Date.now().toString(36)}_${index}`,
    index,
    latitude: point.latitude,
    longitude: point.longitude,
  };
}
