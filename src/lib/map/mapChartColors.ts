import { BRAND } from '../../theme/brandColors';

/**
 * MapLibre paint colors for chart overlays.
 * Intentionally fixed (not ThemeContext dark/redNight variants): overlays must stay
 * legible on OSM water/land tiles across all app themes. Values come from {@link BRAND}.
 */
export const MAP_CHART_WATER_BG = BRAND.waterBg;

export const MAP_BOAT_FILL = BRAND.primary;
export const MAP_BOAT_STALE = BRAND.stale;
export const MAP_BOAT_OUTLINE = BRAND.onPrimary;
export const MAP_COURSE_VECTOR = BRAND.primary;
export const MAP_COURSE_VECTOR_STALE = BRAND.stale;
export const MAP_COURSE_VECTOR_CASING = BRAND.onPrimary;

export const MAP_REGION_FILL = BRAND.primary;
export const MAP_REGION_FILL_ALPHA = BRAND.primarySoft;
export const MAP_REGION_LINE = BRAND.primary;

export const MAP_PASSAGE_LINE = BRAND.primary;
export const MAP_PASSAGE_WAYPOINT = BRAND.accent;
export const MAP_PASSAGE_STROKE = BRAND.onPrimary;

export const MAP_ROUTE_CASING = BRAND.onPrimary;
export const MAP_ROUTE_LINE = BRAND.primary;
export const MAP_WAYPOINT_NEXT = BRAND.primary;
export const MAP_WAYPOINT_IDLE = BRAND.primaryMuted;
export const MAP_XTE_LINE = BRAND.accent;

export const MAP_MOB = BRAND.dangerStrong;
export const MAP_ANCHOR_CENTER = BRAND.success;
export const MAP_MARK = BRAND.accent;
export const MAP_HARBOUR = BRAND.primary;
export const MAP_ANCHORAGE = BRAND.success;
export const MAP_HAZARD = BRAND.dangerStrong;
export const MAP_GENERIC_MARK = '#486581';
export const MAP_TEXT_DARK = '#003d5c';
export const MAP_TRACK_LINE = '#00838f';
export const MAP_RECORDED_TRACK = '#7b1fa2';
export const MAP_DIM_LINE = '#64748b';
export const MAP_STROKE_SHORT = '#fff';

export const MAP_CUSTOM_CORNER = BRAND.danger;
export const MAP_CUSTOM_CORNER_STROKE = BRAND.onPrimary;
export const MAP_CUSTOM_FILL = BRAND.accent;
export const MAP_CUSTOM_LINE = BRAND.danger;
export const MAP_CUSTOM_PREVIEW_FILL = BRAND.accent;

/** Android foreground-service notification tint (Expo Location). */
export const MAP_NOTIFICATION_PRIMARY = BRAND.primary;
export const MAP_NOTIFICATION_DANGER = BRAND.danger;
