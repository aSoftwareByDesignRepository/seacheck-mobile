import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SEACHECK_ROOT = path.resolve(__dirname, '..');
const REGIONS_DIR = path.join(REPO_ROOT, 'planning/app-ideas/seacheck/regions');

function resolveI18nKey(messages: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let cur: unknown = messages;
  for (const part of parts) {
    cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
  }
  return typeof cur === 'string' ? cur : key;
}

function parseRegionPacksFromTs(tsContent: string) {
  const packs: {
    id: string;
    nameKey: string;
    descriptionKey: string;
    bounds: number[];
    minZoom: number;
    maxZoom: number;
    priority: string;
  }[] = [];
  const blockRe =
    /{\s*id:\s*'([^']+)',\s*nameKey:\s*'([^']+)',\s*descriptionKey:\s*'([^']+)',\s*bounds:\s*\[([^\]]+)\],\s*minZoom:\s*(\d+),\s*maxZoom:\s*(\d+),\s*layers:\s*\[[^\]]+\],\s*priority:\s*'(P[012])',/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(tsContent)) !== null) {
    const [, id, nameKey, descriptionKey, boundsRaw, minZoom, maxZoom, priority] = match;
    const bounds = boundsRaw.split(',').map((n) => Number.parseFloat(n.trim()));
    if (bounds.length !== 4 || bounds.some((n) => !Number.isFinite(n))) continue;
    packs.push({
      id,
      nameKey,
      descriptionKey,
      bounds,
      minZoom: Number(minZoom),
      maxZoom: Number(maxZoom),
      priority,
    });
  }
  return packs;
}

describe('planning region geojson sync', () => {
  it('parses the same pack count as REGION_PACKS in regionPacks.ts', () => {
    const ts = readFileSync(path.join(SEACHECK_ROOT, 'src/map/regionPacks.ts'), 'utf8');
    const packs = parseRegionPacksFromTs(ts);
    expect(packs.length).toBe(15);
    expect(packs[0]?.id).toBe('kiel-bay');
  });

  it('geojson files match regionPacks bounds, zoom, and en.json names', () => {
    const ts = readFileSync(path.join(SEACHECK_ROOT, 'src/map/regionPacks.ts'), 'utf8');
    const en = JSON.parse(readFileSync(path.join(SEACHECK_ROOT, 'src/i18n/locales/en.json'), 'utf8'));
    const packs = parseRegionPacksFromTs(ts).map((pack) => ({
      ...pack,
      name: resolveI18nKey(en, pack.nameKey),
    }));

    for (const pack of packs) {
      const raw = readFileSync(path.join(REGIONS_DIR, `${pack.id}.geojson`), 'utf8');
      const feature = JSON.parse(raw);
      expect(feature.properties.id).toBe(pack.id);
      expect(feature.properties.name).toBe(pack.name);
      expect(feature.properties.zoomDefault).toEqual({ min: pack.minZoom, max: pack.maxZoom });
      const ring = feature.geometry.coordinates[0];
      expect(ring[0][0]).toBeCloseTo(pack.bounds[0], 5);
      expect(ring[0][1]).toBeCloseTo(pack.bounds[1], 5);
      expect(ring[2][0]).toBeCloseTo(pack.bounds[2], 5);
      expect(ring[2][1]).toBeCloseTo(pack.bounds[3], 5);
    }
  });
});
