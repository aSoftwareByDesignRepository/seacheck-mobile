import type { RegionPackDefinition } from './regionPacks';

/**
 * Retired macro-regions (pre-2026). Kept so existing offline downloads stay addressable
 * for coverage, deletion, and seamark index — not offered for new downloads.
 */
export const LEGACY_REGION_PACKS: RegionPackDefinition[] = [
  {
    id: 'baltic-west',
    nameKey: 'downloads.packs.balticWest.name',
    descriptionKey: 'downloads.packs.balticWest.description',
    bounds: [9.5, 54.5, 13.5, 58.0],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
    legacy: true,
  },
  {
    id: 'baltic-south',
    nameKey: 'downloads.packs.balticSouth.name',
    descriptionKey: 'downloads.packs.balticSouth.description',
    bounds: [10.0, 53.5, 14.8, 55.2],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
    legacy: true,
  },
  {
    id: 'baltic-south-se',
    nameKey: 'downloads.packs.balticSouthSe.name',
    descriptionKey: 'downloads.packs.balticSouthSe.description',
    bounds: [12.0, 55.2, 17.5, 57.5],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
    legacy: true,
  },
  {
    id: 'baltic-central',
    nameKey: 'downloads.packs.balticCentral.name',
    descriptionKey: 'downloads.packs.balticCentral.description',
    bounds: [16.5, 56.0, 20.5, 58.5],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P1',
    legacy: true,
  },
  {
    id: 'baltic-east',
    nameKey: 'downloads.packs.balticEast.name',
    descriptionKey: 'downloads.packs.balticEast.description',
    bounds: [22.0, 59.0, 27.0, 60.8],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P2',
    legacy: true,
  },
  {
    id: 'baltic-north',
    nameKey: 'downloads.packs.balticNorth.name',
    descriptionKey: 'downloads.packs.balticNorth.description',
    bounds: [19.0, 59.0, 22.5, 61.5],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P2',
    legacy: true,
  },
];

const LEGACY_IDS = new Set(LEGACY_REGION_PACKS.map((p) => p.id));

export function isLegacyRegionPackId(id: string): boolean {
  return LEGACY_IDS.has(id);
}

export function getLegacyRegionPack(id: string): RegionPackDefinition | undefined {
  return LEGACY_REGION_PACKS.find((p) => p.id === id);
}
