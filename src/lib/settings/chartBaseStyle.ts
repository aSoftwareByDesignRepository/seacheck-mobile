/**
 * Coastal base map + OpenSeaMap seamark overlay for MapLibre.
 *
 * Base tiles: OpenStreetMap standard raster (per OpenSeaMap project docs).
 * Seamarks: OpenSeaMap overlay only — never use t*.openseamap.org/tile/ for the base;
 * that endpoint serves empty.png placeholders, not OSM cartography.
 *
 * Tile usage policy: configureChartTileHttp() must set a SeaCheck-identifying User-Agent
 * before any MapLibre map loads (see App.tsx).
 */
export const CHART_BASEMAP_ID = 'osm-standard-v1';

/** OSM standard tiles — MapLibre rotates across entries when multiple are listed. */
export const CHART_BASE_TILE_URLS = [
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
] as const;

/** Canonical probe / logging URL (first host). */
export const CHART_BASE_TILE_URL = CHART_BASE_TILE_URLS[0];

/** OpenSeaMap seamark overlay — second raster source in offline chart packs. */
export const SEAMARK_TILE_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

export const CHART_BASE_ATTRIBUTION = '© OpenStreetMap contributors';
export const CHART_SEAMARK_ATTRIBUTION = '© OpenSeaMap contributors';
