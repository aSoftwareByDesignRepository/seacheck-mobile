/** Web Mercator metres per pixel at equator for zoom 0 (MapLibre / OSM convention). */
const WEB_MERCATOR_M_PER_PX_Z0 = 156543.03392;

/** Zoom where base NM symbol sizes were tuned (~100 m boat). */
export const CHART_SYMBOL_REFERENCE_ZOOM = 13;

/** Target on-screen boat length (px) — Navionics-style fixed screen size when zoomed out. */
export const BOAT_ICON_TARGET_LENGTH_PX = 40;

/** Target on-screen radius for the no-heading diamond (px). */
export const DIAMOND_TARGET_RADIUS_PX = 16;

/** Minimum course-vector line length on screen (px) when zoomed out. */
export const COURSE_VECTOR_MIN_LENGTH_PX = 56;

/** Arrowhead size on screen (px). */
export const COURSE_VECTOR_ARROWHEAD_TARGET_PX = 28;

/** Never shrink below design NM size when zoomed in past reference. */
export const MIN_SYMBOL_SCALE = 1;

/**
 * Safety cap on symbol size in nautical miles (not an arbitrary scale factor).
 * Prevents absurd geo polygons at world zoom while allowing passage overview (z6–8).
 */
export const MAX_SYMBOL_NM_ON_CHART = 120;

export function metresPerPixel(zoom: number, latitudeDeg: number): number {
  const latRad = (latitudeDeg * Math.PI) / 180;
  return (WEB_MERCATOR_M_PER_PX_Z0 * Math.cos(latRad)) / 2 ** zoom;
}

export function nmPerPixel(zoom: number, latitudeDeg: number): number {
  return metresPerPixel(zoom, latitudeDeg) / 1852;
}

/** Convert a desired pixel length to nautical miles at the given chart zoom. */
export function pixelLengthToNm(pixels: number, zoom: number, latitudeDeg: number): number {
  if (!Number.isFinite(pixels) || pixels <= 0) return 0;
  if (!Number.isFinite(zoom) || !Number.isFinite(latitudeDeg)) return 0;
  return pixels * nmPerPixel(zoom, latitudeDeg);
}

/**
 * Scale factor for fixed-NM symbol builders.
 * Keeps symbols at ~targetLengthPx on screen (Navionics / Raymarine behaviour).
 */
export function chartSymbolScaleForZoom(
  zoom: number | null | undefined,
  latitudeDeg: number,
  targetLengthPx: number,
  baseLengthNm: number,
): number {
  if (zoom == null || !Number.isFinite(zoom) || !Number.isFinite(latitudeDeg) || baseLengthNm <= 0) {
    return MIN_SYMBOL_SCALE;
  }
  const desiredLengthNm = pixelLengthToNm(targetLengthPx, zoom, latitudeDeg);
  const rawScale = desiredLengthNm / baseLengthNm;
  if (!Number.isFinite(rawScale) || rawScale <= 0) return MIN_SYMBOL_SCALE;
  const maxScale = MAX_SYMBOL_NM_ON_CHART / baseLengthNm;
  return Math.min(maxScale, Math.max(MIN_SYMBOL_SCALE, rawScale));
}

/** Actual on-screen length (px) after scaling — for tests and diagnostics. */
export function symbolScreenLengthPx(
  scale: number,
  baseLengthNm: number,
  zoom: number,
  latitudeDeg: number,
): number {
  const mpp = nmPerPixel(zoom, latitudeDeg);
  if (mpp <= 0 || !Number.isFinite(scale)) return 0;
  return (baseLengthNm * scale) / mpp;
}

/** Outline / vector line width (px) — slightly thicker when zoomed out for readability. */
export function chartSymbolOutlineWidth(symbolScale: number): number {
  if (!Number.isFinite(symbolScale) || symbolScale <= 1) return 2.5;
  return Math.min(6, Math.max(2.5, 2 + Math.cbrt(symbolScale)));
}

/** Resolve chart zoom for overlays — fall back when region events have not fired yet. */
export function resolveChartZoom(mapZoom: number | null | undefined, fallbackZoom: number): number {
  if (mapZoom != null && Number.isFinite(mapZoom)) return mapZoom;
  return fallbackZoom;
}
