import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import type { LonLat } from '../geo/navigation';

const MIN_SPAN_DEG = 0.02;
const PAD_RATIO = 0.15;

export function boundsFromWaypoints(waypoints: { latitude: number; longitude: number }[]): LngLatBounds | null {
  if (waypoints.length === 0) return null;
  let west = waypoints[0].longitude;
  let east = waypoints[0].longitude;
  let south = waypoints[0].latitude;
  let north = waypoints[0].latitude;
  for (const wp of waypoints) {
    west = Math.min(west, wp.longitude);
    east = Math.max(east, wp.longitude);
    south = Math.min(south, wp.latitude);
    north = Math.max(north, wp.latitude);
  }
  return paddedBounds(west, south, east, north);
}

/** Bounding box for a track line or any lon/lat pairs (WGS84). */
export function boundsFromLonLat(coords: LonLat[]): LngLatBounds | null {
  if (coords.length === 0) return null;
  let west = coords[0][0];
  let east = coords[0][0];
  let south = coords[0][1];
  let north = coords[0][1];
  for (const [lon, lat] of coords) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return paddedBounds(west, south, east, north);
}

function paddedBounds(west: number, south: number, east: number, north: number): LngLatBounds {
  const latSpan = Math.max(north - south, MIN_SPAN_DEG);
  const lonSpan = Math.max(east - west, MIN_SPAN_DEG);
  const padLat = latSpan * PAD_RATIO;
  const padLon = lonSpan * PAD_RATIO;
  return [west - padLon, south - padLat, east + padLon, north + padLat];
}
