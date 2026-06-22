/** Locked first-launch defaults — Cruise/passage (see planning §6.8). */
export const CRUISE_PASSAGE_DEFAULTS = {
  activityProfileId: 'cruise-passage',
  sogUnit: 'kn' as const,
  distanceUnit: 'nm' as const,
  bearingReference: 'true' as const,
  coordFormat: 'ddm' as const,
  mapCourseUp: true,
  followMode: true,
  keepAwakeUnderway: true,
};

export type SogUnit = 'kn' | 'mph' | 'kmh' | 'ms';
export type DistanceUnit = 'nm' | 'km' | 'sm';
export type BearingReference = 'true' | 'magnetic';
export type CoordFormat = 'ddm' | 'dd' | 'dms';
export type LayoutPreset = 'map-forward' | 'instruments-forward' | 'split' | 'minimal';
