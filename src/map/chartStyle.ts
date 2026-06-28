import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { MAP_ATTRIBUTION } from './constants';
import type { ChartBaseStyle } from '../lib/settings/chartBaseStyle';
import { chartBaseStyleTileUrl, DEFAULT_CHART_BASE_STYLE } from '../lib/settings/chartBaseStyle';

export const CHART_STYLE_FILENAME = 'chart-style.json';

export type ChartLayerVisibility = {
  base: boolean;
  seamarks: boolean;
};

/** MapLibre style with base + OpenSeaMap seamark raster sources. */
export function buildChartStyleSpec(baseStyle: ChartBaseStyle = DEFAULT_CHART_BASE_STYLE): StyleSpecification {
  const seamarkTiles = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

  return {
    version: 8,
    name: 'SeaCheck Chart',
    sources: {
      'carto-base': {
        type: 'raster',
        tiles: [chartBaseStyleTileUrl(baseStyle)],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
      'openseamap-seamarks': {
        type: 'raster',
        tiles: [seamarkTiles],
        tileSize: 256,
        maxzoom: 18,
        attribution: '© OpenSeaMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#b8d4e8' },
      },
      {
        id: 'carto-base-layer',
        type: 'raster',
        source: 'carto-base',
      },
      {
        id: 'openseamap-seamarks-layer',
        type: 'raster',
        source: 'openseamap-seamarks',
        paint: { 'raster-opacity': 1 },
      },
    ],
  };
}

export function chartStyleDirectory(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('documentDirectory unavailable');
  return `${root}map/`;
}

export function chartStyleFileUri(): string {
  return `${chartStyleDirectory()}${CHART_STYLE_FILENAME}`;
}

/** Writes chart style JSON to app documents; required for OfflineManager + offline Map. */
export async function ensureChartStyleFile(baseStyle: ChartBaseStyle = DEFAULT_CHART_BASE_STYLE): Promise<string> {
  const dir = chartStyleDirectory();
  const uri = chartStyleFileUri();
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const spec = JSON.stringify(buildChartStyleSpec(baseStyle));
    const existing = await FileSystem.readAsStringAsync(uri).catch(() => null);
    if (existing !== spec) {
      await FileSystem.writeAsStringAsync(uri, spec);
    }
    return uri;
  } catch (error) {
    console.error('[chartStyle] ensureChartStyleFile failed', error);
    throw error;
  }
}

export { MAP_ATTRIBUTION };
