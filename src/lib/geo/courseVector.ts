import { destinationPoint, type LonLat } from './navigation';

/** Standard chart-plotter projection time (minutes at current SOG). */
export const COURSE_VECTOR_MINUTES = 6;

/** Visible stub when stopped or below SOG threshold but heading is known. */
export const COURSE_VECTOR_STUB_NM = 0.08;

/** Cap projection length — avoids absurd vectors at high speed. */
export const COURSE_VECTOR_MAX_NM = 12;

export type CourseVectorInput = {
  latitude: number;
  longitude: number;
  speedKn: number | null;
  bearingDeg: number | null;
};

export type CourseVectorGeometry = {
  /** Rhumb line from position along bearing. */
  line: [LonLat, LonLat];
  /** Length in nautical miles (for a11y / debug). */
  lengthNm: number;
  /** Small wedge at the boat for direction at a glance. */
  wedge: LonLat[];
};

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Distance (NM) for a speed-over-ground projection over `minutes`. */
export function courseVectorLengthNm(speedKn: number | null, minutes: number = COURSE_VECTOR_MINUTES): number {
  const kn = speedKn ?? 0;
  if (kn <= 0) return COURSE_VECTOR_STUB_NM;
  const projected = kn * (minutes / 60);
  return Math.min(COURSE_VECTOR_MAX_NM, Math.max(COURSE_VECTOR_STUB_NM, projected));
}

function headingWedgePoints(center: LonLat, bearingDeg: number, lengthNm: number): LonLat[] {
  const tip = destinationPoint(center, bearingDeg, lengthNm);
  const wing = destinationPoint(center, bearingDeg, lengthNm * 0.55);
  const port = destinationPoint(wing, bearingDeg - 90, lengthNm * 0.35);
  const starboard = destinationPoint(wing, bearingDeg + 90, lengthNm * 0.35);
  return [center, port, tip, starboard, center];
}

/**
 * Builds map geometry for a chart-plotter course vector.
 * Returns null when bearing is unknown (no GPS heading and no COG).
 */
export function buildCourseVectorGeometry(
  input: CourseVectorInput,
  minutes: number = COURSE_VECTOR_MINUTES,
): CourseVectorGeometry | null {
  if (input.bearingDeg == null || Number.isNaN(input.bearingDeg)) return null;

  const bearing = normalizeDeg(input.bearingDeg);
  const from: LonLat = [input.longitude, input.latitude];
  const lengthNm = courseVectorLengthNm(input.speedKn, minutes);
  const to = destinationPoint(from, bearing, lengthNm);
  const wedgeLength = Math.min(0.025, lengthNm * 0.35);

  return {
    line: [from, to],
    lengthNm,
    wedge: headingWedgePoints(from, bearing, wedgeLength),
  };
}
