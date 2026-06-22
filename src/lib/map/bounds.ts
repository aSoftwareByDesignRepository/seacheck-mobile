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
