/**
 * Coastal base map + OpenSeaMap seamark overlay for MapLibre.
 *
 * Base tiles come from OpenSeaMap’s public OSM Mapnik mirrors (same stack their
 * web chart uses under seamarks). Free, no API key, commercial-friendly for
 * OpenSeaMap apps — unlike CARTO Voyager which now watermarks without a key.
 *
 * Keep this as XYZ raster so OfflineManager / ambient-cache downloads stay
 * identical to the previous Carto-based packs (two raster sources).
 */
export const CHART_BASEMAP_ID = 'openseamap-osm-v1';

/** Primary + fallback hosts (MapLibre load-balances across `tiles` entries). */
export const CHART_BASE_TILE_URLS = [
  'https://t1.openseamap.org/tile/{z}/{x}/{y}.png',
  'https://t2.openseamap.org/tile/{z}/{x}/{y}.png',
] as const;

/** Canonical probe / logging URL (first host). */
export const CHART_BASE_TILE_URL = CHART_BASE_TILE_URLS[0];

/** OpenSeaMap seamark overlay — second raster source in offline chart packs. */
export const SEAMARK_TILE_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

export const CHART_BASE_ATTRIBUTION = '© OpenStreetMap contributors © OpenSeaMap';
export const CHART_SEAMARK_ATTRIBUTION = '© OpenSeaMap contributors';
