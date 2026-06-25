/** Planning overlay groups — separate from OpenSeaMap raster zoom rules. */
export type SeamarkPlanningCategory = 'harbour' | 'anchorage' | 'navigation' | 'hazard';

const HARBOUR_TYPES = new Set([
  'harbour',
  'harbor',
  'harbour_basin',
  'small_craft_facility',
  'berth',
  'dock',
  'dry_dock',
  'pontoon',
  'ferry_terminal',
  'ro_ro_terminal',
  'slipway',
]);

const ANCHORAGE_TYPES = new Set(['anchorage', 'mooring', 'mooring_area', 'pile']);

const NAVIGATION_TYPES = new Set([
  'beacon',
  'beacon_lateral',
  'beacon_cardinal',
  'beacon_special_purpose',
  'beacon_isolated_danger',
  'beacon_safe_water',
  'buoy',
  'buoy_lateral',
  'buoy_cardinal',
  'buoy_special_purpose',
  'buoy_isolated_danger',
  'buoy_safe_water',
  'buoy_installation',
  'light',
  'light_float',
  'light_vessel',
  'daymark',
  'leading_line',
  'recommended_track',
  'fairway',
  'notice',
  'radar_transponder',
  'radio_station',
  'fog_signal',
]);

const HAZARD_TYPES = new Set([
  'rock',
  'wreck',
  'obstruction',
  'seagrass',
  'fishing',
  'cable',
  'pipeline',
  'restricted_area',
  'military_area',
]);

function normalizeSeamarkType(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Map OSM seamark tags to a planning category, or null when not shown on the overlay. */
export function classifySeamarkPlanningCategory(
  tags: Record<string, string>,
  fallbackType = '',
): SeamarkPlanningCategory | null {
  const rawType = normalizeSeamarkType(tags['seamark:type'] ?? fallbackType.replace(/ /g, '_'));
  if (!rawType) return null;

  if (HARBOUR_TYPES.has(rawType) || rawType.includes('harbour') || rawType.includes('harbor')) {
    return 'harbour';
  }
  if (ANCHORAGE_TYPES.has(rawType) || rawType.includes('anchor') || rawType.includes('mooring')) {
    return 'anchorage';
  }
  if (NAVIGATION_TYPES.has(rawType) || rawType.startsWith('buoy_') || rawType.startsWith('beacon_') || rawType.startsWith('light')) {
    return 'navigation';
  }
  if (HAZARD_TYPES.has(rawType) || rawType.includes('danger') || rawType.includes('restricted')) {
    return 'hazard';
  }
  return null;
}

export const SEAMARK_PLANNING_CATEGORY_ORDER: readonly SeamarkPlanningCategory[] = [
  'harbour',
  'anchorage',
  'navigation',
  'hazard',
];

export const SEAMARK_PLANNING_COLORS: Record<SeamarkPlanningCategory, string> = {
  harbour: '#1565c0',
  anchorage: '#0d7a4a',
  navigation: '#e65100',
  hazard: '#ba1b1b',
};
