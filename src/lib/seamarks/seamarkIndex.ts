import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { fetchIsEffectivelyOnline } from '../network/connectivity';
import { getDatabase, withDatabaseTransaction } from '../db/database';
import type { SeamarkHit } from './querySeamark';
import { distanceNm, type LonLat } from '../geo/navigation';
import { fetchOverpass } from './overpassClient';
const PICK_RADIUS_M = 40;
const MAX_INDEX_ELEMENTS = 25_000;

type OverpassElement = {
  type: 'node' | 'way';
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function elementPosition(el: OverpassElement): LonLat | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) return [el.lon, el.lat];
  if (el.center) return [el.center.lon, el.center.lat];
  return null;
}

function seamarkLabel(tags: Record<string, string>): { name: string; type: string } {
  const type =
    tags['seamark:type'] ??
    tags['seamark:buoy_lateral:category'] ??
    tags['seamark:beacon_lateral:category'] ??
    tags['seamark:light:character'] ??
    'chart_object';
  const name =
    tags.name ??
    tags['seamark:name'] ??
    tags.ref ??
    tags['seamark:reference'] ??
    type.replace(/_/g, ' ');
  return { name, type: type.replace(/_/g, ' ') };
}

function osmElementId(el: OverpassElement): string {
  return `${el.type}/${el.id ?? '0'}`;
}

/** Remove cached seamarks for a region pack. */
export async function clearSeamarkIndex(packId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM seamarks WHERE pack_id = ?', packId);
}

/** Fetch seamarks inside pack bounds and store in SQLite (best-effort, online only). */
export async function indexSeamarksForPack(packId: string, bounds: LngLatBounds): Promise<number> {
  if (!(await fetchIsEffectivelyOnline())) return 0;

  const [west, south, east, north] = bounds;
  const query = `[out:json][timeout:180];
(
  node["seamark:type"](${south},${west},${north},${east});
  way["seamark:type"](${south},${west},${north},${east});
);
out center tags;`;

  const response = await fetchOverpass(query, 60_000);
  if (!response.ok) throw new Error(`overpass_${response.status}`);

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const elements = (payload.elements ?? []).slice(0, MAX_INDEX_ELEMENTS);

  await withDatabaseTransaction(async (db) => {
    await db.runAsync('DELETE FROM seamarks WHERE pack_id = ?', packId);

    for (const el of elements) {
      if (!el.tags?.['seamark:type']) continue;
      const pos = elementPosition(el);
      if (!pos) continue;
      const { name, type } = seamarkLabel(el.tags);
      await db.runAsync(
        'INSERT OR REPLACE INTO seamarks (id, pack_id, name, type, latitude, longitude, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        osmElementId(el),
        packId,
        name,
        type,
        pos[1],
        pos[0],
        JSON.stringify(el.tags),
      );
    }
  });

  return elements.length;
}

/** Nearest indexed seamark within pick radius (offline). */
export async function queryLocalSeamark(lat: number, lon: number): Promise<SeamarkHit | null> {
  const db = await getDatabase();
  const delta = 0.0008;
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    tags_json: string;
  }>(
    `SELECT id, name, type, latitude, longitude, tags_json FROM seamarks
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
    lat - delta,
    lat + delta,
    lon - delta,
    lon + delta,
  );

  const tap: LonLat = [lon, lat];
  let best: SeamarkHit | null = null;

  for (const row of rows) {
    const distNm = distanceNm(tap, [row.longitude, row.latitude]);
    const distanceM = distNm * 1852;
    if (distanceM > PICK_RADIUS_M) continue;
    let rawTags: Record<string, string> = {};
    try {
      rawTags = JSON.parse(row.tags_json) as Record<string, string>;
    } catch {
      /* ignore */
    }
    const hit: SeamarkHit = {
      name: row.name,
      type: row.type,
      latitude: row.latitude,
      longitude: row.longitude,
      distanceM,
      source: 'local',
      rawTags,
    };
    if (!best || distanceM < best.distanceM) best = hit;
  }

  return best;
}
