import type { LngLatBounds } from '@maplibre/maplibre-react-native';

/** Approximate visible bounds from map centre and zoom (Web Mercator). */
export function approxViewportBounds(
  latitude: number,
  longitude: number,
  zoom: number,
  aspectRatio = 0.75,
  padding = 1.25,
): LngLatBounds {
  const z = Math.max(0, Math.min(22, zoom));
  const halfLon = (180 / 2 ** z) * padding;
  const halfLat = halfLon * aspectRatio * padding;
  const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const lonHalf = halfLon / cosLat;
  return [
    longitude - lonHalf,
    latitude - halfLat,
    longitude + lonHalf,
    latitude + halfLat,
  ];
}
