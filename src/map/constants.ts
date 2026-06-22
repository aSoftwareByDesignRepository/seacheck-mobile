/** Kieler Bucht — default dev / UAT viewport. */
export const KIEL_CENTER: [number, number] = [10.141, 54.323];

export const TILE_URLS = {
  /** Coastal base — Carto Voyager (dev / online only; attribution required). */
  base: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  /** OpenSeaMap seamark overlay (transparent PNG). */
  seamarks: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
} as const;

export const MAP_ATTRIBUTION =
  '© OpenStreetMap contributors © CARTO · © OpenSeaMap · Not for navigation';
