import { BOAT_BOW_OFFSET_NM, scaledBoatBowOffsetNm } from './boatIcon';
import { destinationPoint, type LonLat } from './navigation';
import {
  clampCourseVectorDrawLengthNm,
  courseVectorStubDrawLengthNm,
  COURSE_VECTOR_STUB_TARGET_PX,
  pixelLengthToNm,
} from '../map/chartSymbolScale';
import {
  COURSE_VECTOR_SCALE_MULTIPLIER,
  DEFAULT_COURSE_VECTOR_SCALE,
  type CourseVectorVisualScale,
} from '../settings/mapSettings';

/** Standard chart-plotter projection time (minutes at current SOG). */
export const COURSE_VECTOR_MINUTES = 6;

/** Legacy NM stub — prefer pixel-based stub via chart zoom; kept for tests and fallbacks. */
export const COURSE_VECTOR_STUB_NM = 0.12;

/** Minimum drawn length at scale 1 for moving vectors (before zoom clamp). */
export const COURSE_VECTOR_MIN_VISUAL_NM = 0.35;

/** Cap projection length — avoids absurd vectors at high speed. */
export const COURSE_VECTOR_MAX_NM = 20;

export type CourseVectorInput = {
  latitude: number;
  longitude: number;
  speedKn: number | null;
  bearingDeg: number | null;
};

export type CourseVectorGeometry = {
  /** Rhumb line from bow along bearing. */
  line: [LonLat, LonLat];
  /** True projected length in nautical miles (from GPS position). */
  lengthNm: number;
  /** Length used for drawing (may be longer than true projection for readability). */
  visualLengthNm: number;
  /** Closed ring for arrowhead at the vector tip. */
  arrowhead: LonLat[];
};

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function scaleCapNm(scale: CourseVectorVisualScale): number {
  return COURSE_VECTOR_MAX_NM * COURSE_VECTOR_SCALE_MULTIPLIER[scale];
}

/** Distance (NM) for a speed-over-ground projection over `minutes`. */
export function courseVectorLengthNm(speedKn: number | null, minutes: number = COURSE_VECTOR_MINUTES): number {
  const kn = speedKn ?? 0;
  if (kn <= 0) return COURSE_VECTOR_STUB_NM;
  const projected = kn * (minutes / 60);
  return Math.min(COURSE_VECTOR_MAX_NM, Math.max(COURSE_VECTOR_STUB_NM, projected));
}

/** Drawn line length — scaled for chart prominence without changing the true projection value. */
export function courseVectorVisualLengthNm(
  trueLengthNm: number,
  speedKn: number | null,
  scale: CourseVectorVisualScale = DEFAULT_COURSE_VECTOR_SCALE,
): number {
  const mult = COURSE_VECTOR_SCALE_MULTIPLIER[scale];
  const kn = speedKn ?? 0;
  const maxNm = scaleCapNm(scale);
  const minVisual = COURSE_VECTOR_MIN_VISUAL_NM * mult;

  if (kn <= 0) {
    return Math.min(maxNm, Math.max(trueLengthNm * mult, COURSE_VECTOR_STUB_NM * mult));
  }
  return Math.min(maxNm, Math.max(trueLengthNm * mult, minVisual));
}

/** Base arrowhead size in NM at symbol scale 1. */
export const COURSE_VECTOR_ARROWHEAD_BASE_NM = 0.024;

/** Small chevron at the vector tip — direction cue at a glance. */
export function buildCourseVectorArrowhead(
  from: LonLat,
  bearingDeg: number,
  lengthNm: number,
  symbolScale = 1,
): LonLat[] {
  const tip = destinationPoint(from, bearingDeg, lengthNm);
  const wing = COURSE_VECTOR_ARROWHEAD_BASE_NM * symbolScale;
  const baseCenter = destinationPoint(tip, bearingDeg + 180, wing * 1.33);
  const port = destinationPoint(baseCenter, bearingDeg - 118, wing);
  const star = destinationPoint(baseCenter, bearingDeg + 118, wing);
  return [tip, star, baseCenter, port, tip];
}

export type CourseVectorChartContext = {
  chartZoom: number | null | undefined;
  latitudeDeg: number;
  symbolScale?: number;
  arrowheadScale?: number;
};

/** Pixel-based heading stub at chart zoom — Navionics-style short H-vector when stopped. */
export function courseVectorStubLengthNm(
  chartZoom: number | null | undefined,
  latitudeDeg: number,
  stubPixels: number = COURSE_VECTOR_STUB_TARGET_PX,
): number {
  const drawn = courseVectorStubDrawLengthNm(chartZoom, latitudeDeg, stubPixels);
  return drawn > 0 ? drawn : COURSE_VECTOR_STUB_NM;
}

/** Ensures the vector reads on screen — true NM length unchanged in metadata. */
export function courseVectorDrawLengthNm(
  visualLengthNm: number,
  chartZoom: number | null | undefined,
  latitudeDeg: number,
  headingStub = false,
): number {
  return clampCourseVectorDrawLengthNm(visualLengthNm, chartZoom, latitudeDeg, { headingStub });
}

/**
 * Builds map geometry for a chart-plotter course vector.
 * Returns null when bearing is unknown (no GPS heading and no COG).
 */
export function buildCourseVectorGeometry(
  input: CourseVectorInput,
  minutes: number = COURSE_VECTOR_MINUTES,
  scale: CourseVectorVisualScale = DEFAULT_COURSE_VECTOR_SCALE,
  chart?: CourseVectorChartContext,
): CourseVectorGeometry | null {
  if (input.bearingDeg == null || Number.isNaN(input.bearingDeg)) return null;

  const bearing = normalizeDeg(input.bearingDeg);
  const center: LonLat = [input.longitude, input.latitude];
  const symbolScale = chart?.symbolScale ?? 1;
  const arrowheadScale = chart?.arrowheadScale ?? symbolScale;
  const bowOffset = chart ? scaledBoatBowOffsetNm(symbolScale) : BOAT_BOW_OFFSET_NM;
  const from = destinationPoint(center, bearing, bowOffset);
  const kn = input.speedKn ?? 0;
  const headingStub = kn <= 0;
  const lengthNm = courseVectorLengthNm(input.speedKn, minutes);
  let visualLengthNm = courseVectorVisualLengthNm(lengthNm, input.speedKn, scale);
  if (chart) {
    if (headingStub) {
      visualLengthNm = courseVectorStubLengthNm(chart.chartZoom, chart.latitudeDeg);
    } else {
      visualLengthNm = courseVectorDrawLengthNm(visualLengthNm, chart.chartZoom, chart.latitudeDeg, false);
    }
  }
  const to = destinationPoint(from, bearing, visualLengthNm);

  return {
    line: [from, to],
    lengthNm,
    visualLengthNm,
    arrowhead: buildCourseVectorArrowhead(from, bearing, visualLengthNm, arrowheadScale),
  };
}
