import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { tileCoordsAt } from '../../map/tileMath';

export type TileViewport = {
  center: [number, number];
  zoom: number;
  key: string;
};

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

/** Ordered camera targets that cover every raster tile in bounds across zoom levels. */
export function enumerateTileViewports(bounds: LngLatBounds, minZoom: number, maxZoom: number): TileViewport[] {
  const [west, south, east, north] = bounds;
  const viewports: TileViewport[] = [];
  const seen = new Set<string>();

  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(west, z);
    const xMax = lonToTileX(east, z);
    const yMin = latToTileY(north, z);
    const yMax = latToTileY(south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
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
