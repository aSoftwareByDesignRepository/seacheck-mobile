import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { tileCoordsAt } from '../../map/tileMath';

export type TileViewport = {
  center: [number, number];
  zoom: number;
  key: string;
};

export type EnumerateTileViewportsOptions = {
  /**
   * Camera hop stride in tile units. 1 = centre every tile (slowest, densest).
   * Values > 1 rely on MapLibre painting neighbouring tiles in the same viewport.
   * Always include the max edge so the pack boundary is never skipped.
   */
  strideX?: number;
  strideY?: number;
};

/** OSM/MapLibre raster tiles are 256 CSS pixels at integer zoom. */
export const DOWNLOAD_TILE_SIZE_PX = 256;

function tileCenterLonLat(z: number, x: number, y: number): [number, number] {
  const n = 2 ** z;
  const lon = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  const lat = (latRad * 180) / Math.PI;
  return [lon, lat];
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/**
 * How far apart camera centres can be while still painting every tile once.
 * Underestimates coverage (overlap of 1 tile) so we never skip edge tiles on small phones.
 */
export function estimateDownloadViewportStride(
  mapWidthPx: number,
  mapHeightPx: number,
  tileSizePx: number = DOWNLOAD_TILE_SIZE_PX,
): { strideX: number; strideY: number } {
  const safeW = Math.max(tileSizePx, mapWidthPx);
  const safeH = Math.max(tileSizePx, mapHeightPx);
  const tilesX = Math.max(1, Math.floor(safeW / tileSizePx));
  const tilesY = Math.max(1, Math.floor(safeH / tileSizePx));
  return {
    strideX: Math.max(1, tilesX - 1),
    strideY: Math.max(1, tilesY - 1),
  };
}

/** Inclusive stepped indices that always end on `max`. */
export function steppedTileIndices(min: number, max: number, stride: number): number[] {
  const step = Math.max(1, Math.floor(stride));
  if (max < min) return [];
  const out: number[] = [];
  for (let i = min; i <= max; i += step) {
    out.push(i);
  }
  if (out[out.length - 1] !== max) {
    out.push(max);
  }
  return out;
}

/** Ordered camera targets that cover every raster tile in bounds across zoom levels. */
export function enumerateTileViewports(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
  options?: EnumerateTileViewportsOptions,
): TileViewport[] {
  const [west, south, east, north] = bounds;
  const viewports: TileViewport[] = [];
  const seen = new Set<string>();
  const strideX = Math.max(1, Math.floor(options?.strideX ?? 1));
  const strideY = Math.max(1, Math.floor(options?.strideY ?? 1));

  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(west, z);
    const xMax = lonToTileX(east, z);
    const yMin = latToTileY(north, z);
    const yMax = latToTileY(south, z);
    for (const x of steppedTileIndices(xMin, xMax, strideX)) {
      for (const y of steppedTileIndices(yMin, yMax, strideY)) {
        const key = `${z}/${x}/${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const center = tileCenterLonLat(z, x, y);
        viewports.push({ center, zoom: z, key });
      }
    }
  }

  return viewports;
}

/** Center of the first tile in bounds at minZoom — useful for map warm-up. */
export function firstTileViewport(bounds: LngLatBounds, minZoom: number): TileViewport {
  const [west, south] = bounds;
  const { x, y } = tileCoordsAt(west, south, minZoom);
  return {
    center: tileCenterLonLat(minZoom, x, y),
    zoom: minZoom,
    key: `${minZoom}/${x}/${y}`,
  };
}
