import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { estimateTileCount } from '../../map/tileMath';

export type LonLatPoint = { latitude: number; longitude: number };

/** Normalize two corner taps into [west, south, east, north]. */
export function normalizeBounds(a: LonLatPoint, b: LonLatPoint): LngLatBounds {
  return [
    Math.min(a.longitude, b.longitude),
    Math.min(a.latitude, b.latitude),
    Math.max(a.longitude, b.longitude),
    Math.max(a.latitude, b.latitude),
  ];
}

/**
 * Square download area anchored on the first tap; second tap sets direction and size.
 * Side length is max(|Δlat|, |Δlon|) so the result is always a true square in degrees.
 */
export function squareBoundsFromAnchor(anchor: LonLatPoint, pointer: LonLatPoint): LngLatBounds {
  const dLat = pointer.latitude - anchor.latitude;
  const dLon = pointer.longitude - anchor.longitude;
  const side = Math.max(Math.abs(dLat), Math.abs(dLon));
  if (side === 0) {
    return [anchor.longitude, anchor.latitude, anchor.longitude, anchor.latitude];
  }
  const endLat = anchor.latitude + Math.sign(dLat || 1) * side;
  const endLon = anchor.longitude + Math.sign(dLon || 1) * side;
  return normalizeBounds(anchor, { latitude: endLat, longitude: endLon });
}

/** Expand a rectangle to the smallest square that fully contains it. */
export function squareBoundsContaining(bounds: LngLatBounds): LngLatBounds {
  const [west, south, east, north] = bounds;
  const latSpan = north - south;
  const lonSpan = east - west;
  const side = Math.max(latSpan, lonSpan);
  const latPad = (side - latSpan) / 2;
  const lonPad = (side - lonSpan) / 2;
  return [west - lonPad, south - latPad, east + lonPad, north + latPad];
}

export const MIN_BOUNDS_DEG = 0.02;
export const MAX_BOUNDS_DEG = 3;
export const MAX_TILE_COUNT = 80_000;

export type BoundsValidation =
  | { ok: true; tileCount: number }
  | { ok: false; code: 'too_small' | 'too_large' | 'too_many_tiles' };

export function validateDownloadBounds(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): BoundsValidation {
  const [west, south, east, north] = bounds;
  const latSpan = north - south;
  const lonSpan = east - west;
  if (latSpan < MIN_BOUNDS_DEG || lonSpan < MIN_BOUNDS_DEG) {
    return { ok: false, code: 'too_small' };
  }
  if (latSpan > MAX_BOUNDS_DEG || lonSpan > MAX_BOUNDS_DEG) {
    return { ok: false, code: 'too_large' };
  }
  const tileCount = estimateTileCount(bounds, minZoom, maxZoom);
  if (tileCount > MAX_TILE_COUNT) {
    return { ok: false, code: 'too_many_tiles' };
  }
  return { ok: true, tileCount };
}

export function boundsCenter(bounds: LngLatBounds): LonLatPoint {
  const [west, south, east, north] = bounds;
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

/** Approximate width and height of a bounds box in nautical miles. */
export function boundsDimensionsNm(bounds: LngLatBounds): { widthNm: number; heightNm: number } {
  const [west, south, east, north] = bounds;
  const midLat = (south + north) / 2;
  const heightNm = (north - south) * 60;
  const lonSpan = west <= east ? east - west : 360 - west + east;
  const widthNm = lonSpan * 60 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  return { widthNm, heightNm };
}

/** Wrap longitude to [-180, 180]. */
export function normalizeLon(lon: number): number {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

/**
 * Whether a point lies inside LngLatBounds.
 * When west > east the box crosses the antimeridian (Pacific / wrap-around packs).
 */
export function pointInLngLatBounds(bounds: LngLatBounds, lat: number, lon: number): boolean {
  const [west, south, east, north] = bounds;
  if (lat < south || lat > north) return false;
  const normalizedLon = normalizeLon(lon);
  if (west <= east) {
    return normalizedLon >= west && normalizedLon <= east;
  }
  return normalizedLon >= west || normalizedLon <= east;
}

/** Expand bounds by a nautical-mile buffer; supports antimeridian-crossing boxes. */
export function expandLngLatBounds(bounds: LngLatBounds, bufferNm: number): LngLatBounds {
  const [west, south, east, north] = bounds;
  const midLat = (south + north) / 2;
  const dLat = bufferNm / 60;
  const dLon = bufferNm / (60 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return [
    normalizeLon(west - dLon),
    Math.max(-90, south - dLat),
    normalizeLon(east + dLon),
    Math.min(90, north + dLat),
  ];
}
