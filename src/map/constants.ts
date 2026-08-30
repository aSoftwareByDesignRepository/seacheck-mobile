import {
  CHART_BASE_TILE_URL,
  SEAMARK_TILE_URL,
} from '../lib/settings/chartBaseStyle';

/** Kieler Bucht — default dev / UAT viewport. */
export const KIEL_CENTER: [number, number] = [10.141, 54.323];

export const TILE_URLS = {
  /** Coastal base — OpenSeaMap OSM Mapnik (free, no API key; attribution required). */
  base: CHART_BASE_TILE_URL,
  /** OpenSeaMap seamark overlay (transparent PNG). */
  seamarks: SEAMARK_TILE_URL,
} as const;

export const MAP_ATTRIBUTION =
  '© OpenStreetMap contributors · © OpenSeaMap · Not for navigation';

/** Extra attribution when the optional online depth overlay is visible. */
export const MAP_DEPTH_ATTRIBUTION_EXTRA =
  '· GEBCO / OpenSeaMap depths (unofficial, online only)';
