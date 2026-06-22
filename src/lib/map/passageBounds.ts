import type { LngLatBounds } from '@maplibre/maplibre-react-native';

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
  const latSpan = Math.max(north - south, MIN_SPAN_DEG);
  const lonSpan = Math.max(east - west, MIN_SPAN_DEG);
  const padLat = latSpan * PAD_RATIO;
  const padLon = lonSpan * PAD_RATIO;
  return [west - padLon, south - padLat, east + padLon, north + padLat];
}
