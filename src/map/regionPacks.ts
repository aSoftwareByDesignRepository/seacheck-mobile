import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { getLegacyRegionPack } from './legacyRegionPacks';

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
  /** Retired macro-region — offline use only, not downloadable. */
  legacy?: boolean;
};

/**
 * Corridor-sized offline packs (NV Charts / Navionics model): one sailing area per download,
 * zoom matched to area size — z8–12 for open-sea legs, z10–14 for straits and harbour approaches.
 */
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
    id: 'kattegat-north',
    nameKey: 'downloads.packs.kattegatNorth.name',
    descriptionKey: 'downloads.packs.kattegatNorth.description',
    bounds: [9.5, 56.8, 12.0, 58.0],
    minZoom: 8,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'kattegat-south',
    nameKey: 'downloads.packs.kattegatSouth.name',
    descriptionKey: 'downloads.packs.kattegatSouth.description',
    bounds: [9.5, 54.5, 12.0, 57.0],
    minZoom: 9,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'danish-belts',
    nameKey: 'downloads.packs.danishBelts.name',
    descriptionKey: 'downloads.packs.danishBelts.description',
    bounds: [10.0, 54.8, 11.8, 55.8],
    minZoom: 10,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'oresund',
    nameKey: 'downloads.packs.oresund.name',
    descriptionKey: 'downloads.packs.oresund.description',
    bounds: [12.2, 55.35, 13.6, 56.15],
    minZoom: 10,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'bornholm',
    nameKey: 'downloads.packs.bornholm.name',
    descriptionKey: 'downloads.packs.bornholm.description',
    bounds: [14.5, 54.7, 15.8, 55.7],
    minZoom: 10,
    maxZoom: 14,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'german-baltic-west',
    nameKey: 'downloads.packs.germanBalticWest.name',
    descriptionKey: 'downloads.packs.germanBalticWest.description',
    bounds: [9.8, 53.5, 11.8, 54.8],
    minZoom: 9,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'german-baltic-east',
    nameKey: 'downloads.packs.germanBalticEast.name',
    descriptionKey: 'downloads.packs.germanBalticEast.description',
    bounds: [11.0, 53.8, 14.8, 55.2],
    minZoom: 9,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'skane-coast',
    nameKey: 'downloads.packs.skaneCoast.name',
    descriptionKey: 'downloads.packs.skaneCoast.description',
    bounds: [12.5, 55.2, 14.5, 56.0],
    minZoom: 9,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'blekinge',
    nameKey: 'downloads.packs.blekinge.name',
    descriptionKey: 'downloads.packs.blekinge.description',
    bounds: [14.0, 55.8, 16.5, 56.8],
    minZoom: 9,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'kalmar-sound',
    nameKey: 'downloads.packs.kalmarSound.name',
    descriptionKey: 'downloads.packs.kalmarSound.description',
    bounds: [15.5, 56.5, 17.5, 57.5],
    minZoom: 9,
    maxZoom: 13,
    layers: ['base', 'seamarks'],
    priority: 'P0',
  },
  {
    id: 'gotland-west',
    nameKey: 'downloads.packs.gotlandWest.name',
    descriptionKey: 'downloads.packs.gotlandWest.description',
    bounds: [17.0, 56.5, 19.5, 58.0],
    minZoom: 8,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P1',
  },
  {
    id: 'gotland-east',
    nameKey: 'downloads.packs.gotlandEast.name',
    descriptionKey: 'downloads.packs.gotlandEast.description',
    bounds: [19.5, 56.5, 20.5, 58.5],
    minZoom: 9,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P1',
  },
  {
    id: 'gulf-finland-west',
    nameKey: 'downloads.packs.gulfFinlandWest.name',
    descriptionKey: 'downloads.packs.gulfFinlandWest.description',
    bounds: [22.0, 59.0, 27.0, 60.8],
    minZoom: 8,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P2',
  },
  {
    id: 'aland-bothnia-south',
    nameKey: 'downloads.packs.alandBothniaSouth.name',
    descriptionKey: 'downloads.packs.alandBothniaSouth.description',
    bounds: [19.0, 59.0, 22.5, 61.5],
    minZoom: 8,
    maxZoom: 12,
    layers: ['base', 'seamarks'],
    priority: 'P2',
  },
];

export function getRegionPack(id: string): RegionPackDefinition | undefined {
  return REGION_PACKS.find((p) => p.id === id);
}

/** Current or retired definition — for coverage labels and legacy UI. */
export function resolveRegionPack(id: string): RegionPackDefinition | undefined {
  return getRegionPack(id) ?? getLegacyRegionPack(id);
}
