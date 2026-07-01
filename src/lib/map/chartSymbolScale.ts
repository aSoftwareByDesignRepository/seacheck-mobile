/** Web Mercator metres per pixel at equator for zoom 0 (MapLibre / OSM convention). */
const WEB_MERCATOR_M_PER_PX_Z0 = 156543.03392;

/** Zoom used when live region zoom is not yet available. */
export const CHART_SYMBOL_REFERENCE_ZOOM = 13;

/**
 * Target on-screen boat length (px).
 * Raymarine / Navionics keep the vessel symbol at a fixed screen size at every zoom level;
 * ~18–22 px matches the “small vessel” end of that range on phone charts.
 */
export const BOAT_ICON_TARGET_LENGTH_PX = 20;

/** Target on-screen radius for the no-heading diamond (px). */
export const DIAMOND_TARGET_RADIUS_PX = 7;

/** Minimum course-vector line length on screen (px) when zoomed out. */
export const COURSE_VECTOR_MIN_LENGTH_PX = 32;

/** Heading-only stub when stopped — fixed screen length (Navionics H-vector stub). */
export const COURSE_VECTOR_STUB_TARGET_PX = 22;

/** Arrowhead size on screen (px). */
export const COURSE_VECTOR_ARROWHEAD_TARGET_PX = 10;

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
 * Keeps symbols at ~targetLengthPx on screen at every zoom (Navionics / Raymarine behaviour).
 * Shrinks geo size when zoomed in; expands when zoomed out — never grows with zoom-in.
 */
export function chartSymbolScaleForZoom(
  zoom: number | null | undefined,
  latitudeDeg: number,
  targetLengthPx: number,
  baseLengthNm: number,
): number {
  const resolvedZoom =
    zoom != null && Number.isFinite(zoom) ? zoom : CHART_SYMBOL_REFERENCE_ZOOM;
  if (!Number.isFinite(latitudeDeg) || baseLengthNm <= 0) {
    return 1;
  }
  const desiredLengthNm = pixelLengthToNm(targetLengthPx, resolvedZoom, latitudeDeg);
  const rawScale = desiredLengthNm / baseLengthNm;
  if (!Number.isFinite(rawScale) || rawScale <= 0) return 1;
  const maxScale = MAX_SYMBOL_NM_ON_CHART / baseLengthNm;
  return Math.min(maxScale, rawScale);
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

/** Outline / vector line width (px) — constant thin stroke like chart plotters. */
export function chartSymbolOutlineWidth(_symbolScale = 1): number {
  return 2;
}

/** Resolve chart zoom for overlays — always returns a finite level. */
export function resolveChartZoom(mapZoom: number | null | undefined, fallbackZoom: number): number {
  if (mapZoom != null && Number.isFinite(mapZoom)) return mapZoom;
  if (Number.isFinite(fallbackZoom)) return fallbackZoom;
  return CHART_SYMBOL_REFERENCE_ZOOM;
}

export type CourseVectorDrawClamp = {
  /** When true, length is already pixel-derived — skip moving-vector minimum floor. */
  headingStub?: boolean;
  minPixels?: number;
};

/**
 * Clamp drawn vector length in NM so it reads on screen at every zoom.
 * - Heading stub: pixel-fixed stub with optional minimum when zoomed out.
 * - Moving vector: true projected NM with minimum-pixel floor when zoomed out.
 */
export function clampCourseVectorDrawLengthNm(
  visualLengthNm: number,
  chartZoom: number | null | undefined,
  latitudeDeg: number,
  clamp: CourseVectorDrawClamp = {},
): number {
  if (!Number.isFinite(visualLengthNm) || visualLengthNm <= 0) return 0;
  if (clamp.headingStub) return visualLengthNm;

  const zoom = resolveChartZoom(chartZoom, CHART_SYMBOL_REFERENCE_ZOOM);
  if (!Number.isFinite(latitudeDeg)) return visualLengthNm;

  const minPixels = clamp.minPixels ?? COURSE_VECTOR_MIN_LENGTH_PX;
  const minNm = pixelLengthToNm(minPixels, zoom, latitudeDeg);
  return minNm > 0 ? Math.max(visualLengthNm, minNm) : visualLengthNm;
}

/** Pixel-fixed heading stub length in NM at the current chart zoom. */
export function courseVectorStubDrawLengthNm(
  chartZoom: number | null | undefined,
  latitudeDeg: number,
  stubPixels: number = COURSE_VECTOR_STUB_TARGET_PX,
): number {
  const zoom = resolveChartZoom(chartZoom, CHART_SYMBOL_REFERENCE_ZOOM);
  if (!Number.isFinite(latitudeDeg)) return 0;
  return pixelLengthToNm(stubPixels, zoom, latitudeDeg);
}

/** On-screen length (px) of a NM vector at the given chart zoom. */
export function vectorScreenLengthPx(lengthNm: number, zoom: number, latitudeDeg: number): number {
  const mpp = nmPerPixel(zoom, latitudeDeg);
  if (mpp <= 0 || !Number.isFinite(lengthNm)) return 0;
  return lengthNm / mpp;
}
