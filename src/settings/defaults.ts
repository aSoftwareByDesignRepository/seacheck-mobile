import {
  DEFAULT_COURSE_VECTOR_MINUTES,
  DEFAULT_FOLLOW_ZOOM,
  type CourseVectorMinutes,
  type FollowZoomLevel,
} from '../lib/settings/mapSettings';

/** Locked first-launch defaults — Cruise/passage (see planning §6.8). */
export const CRUISE_PASSAGE_DEFAULTS = {
  activityProfileId: 'cruise-passage',
  sogUnit: 'kn' as const,
  distanceUnit: 'nm' as const,
  bearingReference: 'true' as const,
  coordFormat: 'ddm' as const,
  mapCourseUp: true,
  mapShowCourseVector: true,
  mapCourseVectorMinutes: DEFAULT_COURSE_VECTOR_MINUTES as CourseVectorMinutes,
  mapFollowZoom: DEFAULT_FOLLOW_ZOOM as FollowZoomLevel,
  followMode: true,
  keepAwakeUnderway: true,
};

export type { CourseVectorMinutes, FollowZoomLevel };

export type SogUnit = 'kn' | 'mph' | 'kmh' | 'ms';
export type DistanceUnit = 'nm' | 'km' | 'sm';
export type BearingReference = 'true' | 'magnetic';
export type CoordFormat = 'ddm' | 'dd' | 'dms';
export type LayoutPreset = 'map-forward' | 'instruments-forward' | 'split' | 'minimal' | 'coordinates';
export type PanelSide = 'auto' | 'port' | 'starboard';
