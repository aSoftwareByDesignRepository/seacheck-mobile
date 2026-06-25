/** Course-vector projection length presets (minutes at current SOG). */
export type CourseVectorMinutes = 3 | 6 | 10;

export const COURSE_VECTOR_MINUTE_OPTIONS: readonly CourseVectorMinutes[] = [3, 6, 10];

export const DEFAULT_COURSE_VECTOR_MINUTES: CourseVectorMinutes = 6;

export function normalizeCourseVectorMinutes(value: unknown): CourseVectorMinutes {
  const n = typeof value === 'number' ? value : Number(value);
  if (n === 3 || n === 10) return n;
  return DEFAULT_COURSE_VECTOR_MINUTES;
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
