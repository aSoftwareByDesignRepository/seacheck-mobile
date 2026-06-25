import type { LngLatBounds } from '@maplibre/maplibre-react-native';

export type RegionLayer = 'base' | 'seamarks';

export type RegionPackDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
  layers: RegionLayer[];
  priority: 'P0' | 'P1' | 'P2';
};

/** Pre-defined packs — bounds from planning/app-ideas/seacheck/regions/*.geojson */
export const REGION_PACKS: RegionPackDefinition[] = [
  {
    id: 'kiel-bay',
    nameKey: 'downloads.packs.kielBay.name',
    descriptionKey: 'downloads.packs.kielBay.description',
    bounds: [10.05, 54.22, 10.25, 54.42],
    minZoom: 10,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'baltic-west',
    nameKey: 'downloads.packs.balticWest.name',
    descriptionKey: 'downloads.packs.balticWest.description',
    bounds: [9.5, 54.5, 13.5, 58.0],
    minZoom: 8,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
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
  },
];

export function getRegionPack(id: string): RegionPackDefinition | undefined {
  return REGION_PACKS.find((p) => p.id === id);
}
