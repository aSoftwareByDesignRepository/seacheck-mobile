/** Course-vector projection length presets (minutes at current SOG). */
export type CourseVectorMinutes = 3 | 6 | 10 | 15 | 20;

export const COURSE_VECTOR_MINUTE_OPTIONS: readonly CourseVectorMinutes[] = [3, 6, 10, 15, 20];

export const DEFAULT_COURSE_VECTOR_MINUTES: CourseVectorMinutes = 6;

export function normalizeCourseVectorMinutes(value: unknown): CourseVectorMinutes {
  const n = typeof value === 'number' ? value : Number(value);
  if (COURSE_VECTOR_MINUTE_OPTIONS.includes(n as CourseVectorMinutes)) return n as CourseVectorMinutes;
  return DEFAULT_COURSE_VECTOR_MINUTES;
}

/** How prominently the course line is drawn on the chart (Navionics-style length). */
export type CourseVectorVisualScale = 'standard' | 'long' | 'extra';

export const COURSE_VECTOR_SCALE_OPTIONS: readonly CourseVectorVisualScale[] = ['standard', 'long', 'extra'];

export const COURSE_VECTOR_SCALE_MULTIPLIER: Record<CourseVectorVisualScale, number> = {
  standard: 1,
  long: 1.5,
  extra: 2,
};

export const DEFAULT_COURSE_VECTOR_SCALE: CourseVectorVisualScale = 'long';

export function normalizeCourseVectorScale(value: unknown): CourseVectorVisualScale {
  if (value === 'standard' || value === 'long' || value === 'extra') return value;
  return DEFAULT_COURSE_VECTOR_SCALE;
}

/** Map zoom level when follow mode recentres on GPS. */
export type FollowZoomLevel = 10 | 11 | 12 | 13 | 14 | 15 | 16;

export const FOLLOW_ZOOM_OPTIONS: readonly FollowZoomLevel[] = [10, 11, 12, 13, 14, 15, 16];

export const DEFAULT_FOLLOW_ZOOM: FollowZoomLevel = 13;

export function normalizeFollowZoom(value: unknown): FollowZoomLevel {
  const n = typeof value === 'number' ? value : Number(value);
  if (FOLLOW_ZOOM_OPTIONS.includes(n as FollowZoomLevel)) return n as FollowZoomLevel;
  return DEFAULT_FOLLOW_ZOOM;
}

/** Anchor drag alarm radius presets (nautical miles). */
export type AnchorRadiusNm = 0.03 | 0.05 | 0.1 | 0.15 | 0.2;

export const ANCHOR_RADIUS_NM_OPTIONS: readonly AnchorRadiusNm[] = [0.03, 0.05, 0.1, 0.15, 0.2];

export const DEFAULT_ANCHOR_RADIUS_NM: AnchorRadiusNm = 0.05;

export function normalizeAnchorRadiusNm(value: unknown): AnchorRadiusNm {
  const n = typeof value === 'number' ? value : Number(value);
  if (ANCHOR_RADIUS_NM_OPTIONS.includes(n as AnchorRadiusNm)) return n as AnchorRadiusNm;
  return DEFAULT_ANCHOR_RADIUS_NM;
}
