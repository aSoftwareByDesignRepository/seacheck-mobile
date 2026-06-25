import type { SeamarkPlanningCategory } from '../seamarks/seamarkCategories';

/** Minimum map zoom before a planning category is drawn (lower = visible when zoomed out further). */
export type SeamarkPlanningZoom = 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const SEAMARK_PLANNING_ZOOM_OPTIONS: readonly SeamarkPlanningZoom[] = [8, 9, 10, 11, 12, 13, 14];

export type SeamarkPlanningCategoryConfig = {
  enabled: boolean;
  fromZoom: SeamarkPlanningZoom;
};

export type SeamarkPlanningConfig = {
  enabled: boolean;
  harbour: SeamarkPlanningCategoryConfig;
  anchorage: SeamarkPlanningCategoryConfig;
  navigation: SeamarkPlanningCategoryConfig;
  hazard: SeamarkPlanningCategoryConfig;
};

export const DEFAULT_SEAMARK_PLANNING: SeamarkPlanningConfig = {
  enabled: true,
  harbour: { enabled: true, fromZoom: 8 },
  anchorage: { enabled: true, fromZoom: 9 },
  navigation: { enabled: false, fromZoom: 12 },
  hazard: { enabled: true, fromZoom: 10 },
};

export function normalizeSeamarkPlanningZoom(value: unknown, fallback: SeamarkPlanningZoom): SeamarkPlanningZoom {
  const n = typeof value === 'number' ? value : Number(value);
  if (SEAMARK_PLANNING_ZOOM_OPTIONS.includes(n as SeamarkPlanningZoom)) return n as SeamarkPlanningZoom;
  return fallback;
}

function normalizeCategoryConfig(
  raw: unknown,
  fallback: SeamarkPlanningCategoryConfig,
): SeamarkPlanningCategoryConfig {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<SeamarkPlanningCategoryConfig>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    fromZoom: normalizeSeamarkPlanningZoom(obj.fromZoom, fallback.fromZoom),
  };
}

export function normalizeSeamarkPlanning(raw: unknown): SeamarkPlanningConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_SEAMARK_PLANNING;
  const obj = raw as Partial<SeamarkPlanningConfig>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_SEAMARK_PLANNING.enabled,
    harbour: normalizeCategoryConfig(obj.harbour, DEFAULT_SEAMARK_PLANNING.harbour),
    anchorage: normalizeCategoryConfig(obj.anchorage, DEFAULT_SEAMARK_PLANNING.anchorage),
    navigation: normalizeCategoryConfig(obj.navigation, DEFAULT_SEAMARK_PLANNING.navigation),
    hazard: normalizeCategoryConfig(obj.hazard, DEFAULT_SEAMARK_PLANNING.hazard),
  };
}

export function patchSeamarkPlanningCategory(
  config: SeamarkPlanningConfig,
  category: SeamarkPlanningCategory,
  patch: Partial<SeamarkPlanningCategoryConfig>,
): SeamarkPlanningConfig {
  return {
    ...config,
    [category]: { ...config[category], ...patch },
  };
}

/** True when the category should render at the current map zoom. */
export function isSeamarkPlanningCategoryVisible(
  config: SeamarkPlanningConfig,
  category: SeamarkPlanningCategory,
  mapZoom: number | null,
): boolean {
  if (!config.enabled) return false;
  const cat = config[category];
  if (!cat.enabled) return false;
  if (mapZoom == null || !Number.isFinite(mapZoom)) return false;
  return mapZoom >= cat.fromZoom;
}
