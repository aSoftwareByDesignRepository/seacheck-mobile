import { bearingTrue, distanceNm, type LonLat } from '../geo/navigation';
import { fetchIsEffectivelyOffline } from '../network/connectivity';
import { fetchWithTimeout } from '../network/fetchWithTimeout';

export type SeamarkHit = {
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceM: number;
  source: 'overpass' | 'local' | 'unknown';
  rawTags: Record<string, string>;
};

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 40;

type OverpassElement = {
  type: 'node' | 'way';
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

/** Nearest OpenSeaMap seamark — local SQLite index first, then Overpass when online. */
export async function queryNearestSeamark(lat: number, lon: number): Promise<SeamarkHit | null> {
  const { queryLocalSeamark } = await import('./seamarkIndex');
  const local = await queryLocalSeamark(lat, lon);
  if (local) return local;

  if (await fetchIsEffectivelyOffline()) return null;

  return queryOverpassSeamark(lat, lon);
}

/** Online Overpass lookup. Returns null when offline or none found. */
export async function queryOverpassSeamark(lat: number, lon: number): Promise<SeamarkHit | null> {
  const query = `[out:json][timeout:12];
(
  node["seamark:type"](around:${SEARCH_RADIUS_M},${lat},${lon});
  way["seamark:type"](around:${SEARCH_RADIUS_M},${lat},${lon});
);
out center tags;`;

  const response = await fetchWithTimeout(
    OVERPASS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
    15_000,
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const tap: LonLat = [lon, lat];
  let best: SeamarkHit | null = null;

  for (const el of payload.elements ?? []) {
    if (!el.tags?.['seamark:type']) continue;
    const pos = elementPosition(el);
    if (!pos) continue;
    const distNm = distanceNm(tap, pos);
    const distanceM = distNm * 1852;
    if (distanceM > SEARCH_RADIUS_M) continue;
    const { name, type } = seamarkLabel(el.tags);
    const hit: SeamarkHit = {
      name,
      type,
      latitude: pos[1],
      longitude: pos[0],
      distanceM,
      source: 'overpass',
      rawTags: el.tags,
    };
    if (!best || distanceM < best.distanceM) best = hit;
  }

  return best;
}

export function unknownChartObject(lat: number, lon: number): SeamarkHit {
  return {
    name: '',
    type: 'chart_object',
    latitude: lat,
    longitude: lon,
    distanceM: 0,
    source: 'unknown',
    rawTags: {},
  };
}

export function seamarkBearingFrom(from: LonLat, hit: SeamarkHit): number {
  return bearingTrue(from, [hit.longitude, hit.latitude]);
}
