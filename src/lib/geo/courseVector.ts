import { BOAT_BOW_OFFSET_NM } from './boatIcon';
import { destinationPoint, type LonLat } from './navigation';
import {
  COURSE_VECTOR_SCALE_MULTIPLIER,
  DEFAULT_COURSE_VECTOR_SCALE,
  type CourseVectorVisualScale,
} from '../settings/mapSettings';

/** Standard chart-plotter projection time (minutes at current SOG). */
export const COURSE_VECTOR_MINUTES = 6;

/** Visible stub when stopped or below SOG threshold but heading is known. */
export const COURSE_VECTOR_STUB_NM = 0.28;

/** Minimum drawn length so the vector reads on the chart (Navionics-style prominence). */
export const COURSE_VECTOR_MIN_VISUAL_NM = 0.55;

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

/** Small chevron at the vector tip — direction cue at a glance. */
export function buildCourseVectorArrowhead(from: LonLat, bearingDeg: number, lengthNm: number): LonLat[] {
  const tip = destinationPoint(from, bearingDeg, lengthNm);
  const baseCenter = destinationPoint(tip, bearingDeg + 180, 0.032);
  const port = destinationPoint(baseCenter, bearingDeg - 118, 0.024);
  const star = destinationPoint(baseCenter, bearingDeg + 118, 0.024);
  return [tip, star, baseCenter, port, tip];
}

/**
 * Builds map geometry for a chart-plotter course vector.
 * Returns null when bearing is unknown (no GPS heading and no COG).
 */
export function buildCourseVectorGeometry(
  input: CourseVectorInput,
  minutes: number = COURSE_VECTOR_MINUTES,
  scale: CourseVectorVisualScale = DEFAULT_COURSE_VECTOR_SCALE,
): CourseVectorGeometry | null {
  if (input.bearingDeg == null || Number.isNaN(input.bearingDeg)) return null;

  const bearing = normalizeDeg(input.bearingDeg);
  const center: LonLat = [input.longitude, input.latitude];
  const from = destinationPoint(center, bearing, BOAT_BOW_OFFSET_NM);
  const lengthNm = courseVectorLengthNm(input.speedKn, minutes);
  const visualLengthNm = courseVectorVisualLengthNm(lengthNm, input.speedKn, scale);
  const to = destinationPoint(from, bearing, visualLengthNm);

  return {
    line: [from, to],
    lengthNm,
    visualLengthNm,
    arrowhead: buildCourseVectorArrowhead(from, bearing, visualLengthNm),
  };
}
