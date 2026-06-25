import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { getDatabase } from '../db/database';
import { classifySeamarkPlanningCategory, type SeamarkPlanningCategory } from './seamarkCategories';
import {
  isSeamarkPlanningCategoryVisible,
  type SeamarkPlanningConfig,
} from '../settings/seamarkSettings';

export type PlanningSeamarkFeature = {
  id: string;
  name: string;
  category: SeamarkPlanningCategory;
  latitude: number;
  longitude: number;
};

const MAX_FEATURES = 400;

/** Indexed seamarks inside bounds, filtered by planning settings and zoom. */
export async function queryPlanningSeamarksInBounds(
  bounds: LngLatBounds,
  config: SeamarkPlanningConfig,
  mapZoom: number | null,
): Promise<PlanningSeamarkFeature[]> {
  if (!config.enabled || mapZoom == null) return [];

  const [west, south, east, north] = bounds;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    tags_json: string;
  }>(
    `SELECT id, name, type, latitude, longitude, tags_json FROM seamarks
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
     LIMIT ?`,
    south,
    north,
    west,
    east,
    MAX_FEATURES * 2,
  );

  const out: PlanningSeamarkFeature[] = [];

  for (const row of rows) {
    let tags: Record<string, string> = {};
    try {
      tags = JSON.parse(row.tags_json) as Record<string, string>;
    } catch {
      /* ignore */
    }
    const category = classifySeamarkPlanningCategory(tags, row.type);
    if (!category) continue;
    if (!isSeamarkPlanningCategoryVisible(config, category, mapZoom)) continue;
    out.push({
      id: row.id,
      name: row.name,
      category,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    if (out.length >= MAX_FEATURES) break;
  }

  return out;
}
