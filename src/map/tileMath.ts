import type { LngLatBounds } from '@maplibre/maplibre-react-native';

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** Web mercator tile index for a point at a given zoom. */
export function tileCoordsAt(lon: number, lat: number, zoom: number): { x: number; y: number } {
  return { x: lonToTileX(lon, zoom), y: latToTileY(lat, zoom) };
}

/** Substitute z/x/y into a MapLibre raster tile URL template. */
export function formatRasterTileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/** Approximate raster tile count for a bounds box across zoom levels (both layers ≈ ×2). */
export function estimateTileCount(bounds: LngLatBounds, minZoom: number, maxZoom: number, layerCount = 2): number {
  const [west, south, east, north] = bounds;
  let tiles = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(west, z);
    const xMax = lonToTileX(east, z);
    const yMin = latToTileY(north, z);
    const yMax = latToTileY(south, z);
    tiles += (xMax - xMin + 1) * (yMax - yMin + 1);
  }
  return tiles * layerCount;
}

/** Rough PNG storage estimate (KB) for planning UI. */
export function estimateDownloadKb(tileCount: number, avgKbPerTile = 28): number {
  return tileCount * avgKbPerTile;
}

export function formatStorageSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}
