import {
  DEFAULT_ANCHOR_RADIUS_NM,
  DEFAULT_COURSE_VECTOR_MINUTES,
  DEFAULT_COURSE_VECTOR_SCALE,
  DEFAULT_FOLLOW_ZOOM,
  type AnchorRadiusNm,
  type CourseVectorMinutes,
  type CourseVectorVisualScale,
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
  mapCourseVectorScale: DEFAULT_COURSE_VECTOR_SCALE as CourseVectorVisualScale,
  mapFollowZoom: DEFAULT_FOLLOW_ZOOM as FollowZoomLevel,
  anchorRadiusNm: DEFAULT_ANCHOR_RADIUS_NM as AnchorRadiusNm,
  followMode: true,
  keepAwakeUnderway: true,
  /** Cross-track error in instrument panels — off by default; XTE alarms are unaffected. */
  mapShowXte: false,
  /** Leeway (COG vs heading) in instrument panels — off by default. */
  mapShowLeeway: false,
  /** Accuracy-weighted position smoothing for map display — alarms always use raw GPS. */
  gpsSmoothPosition: true,
};

export type { AnchorRadiusNm, CourseVectorMinutes, CourseVectorVisualScale, FollowZoomLevel };

export type SogUnit = 'kn' | 'mph' | 'kmh' | 'ms';
export type DistanceUnit = 'nm' | 'km' | 'sm';
export type BearingReference = 'true' | 'magnetic';
export type CoordFormat = 'ddm' | 'dd' | 'dms';
export type LayoutPreset = 'map-forward' | 'minimal' | 'instruments-only';
export type PanelSide = 'auto' | 'port' | 'starboard';
