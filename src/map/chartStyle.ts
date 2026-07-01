import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { MAP_ATTRIBUTION } from './constants';
import { CHART_BASE_TILE_URL } from '../lib/settings/chartBaseStyle';

export const CHART_STYLE_FILENAME = 'chart-style.json';

export type ChartLayerVisibility = {
  base: boolean;
  seamarks: boolean;
};

/** MapLibre style with Voyager base + OpenSeaMap seamark raster sources. */
export function buildChartStyleSpec(): StyleSpecification {
  const seamarkTiles = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

  return {
    version: 8,
    name: 'SeaCheck Chart',
    sources: {
      'carto-base': {
        type: 'raster',
        tiles: [CHART_BASE_TILE_URL],
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
  return toMapLibreStyleUri(chartStyleFilesystemPath());
}

export function chartStyleFilesystemPath(): string {
  return `${chartStyleDirectory()}${CHART_STYLE_FILENAME}`;
}

/** MapLibre offline expects file:// URIs for on-disk style JSON. */
export function toMapLibreStyleUri(uri: string): string {
  if (/^https?:\/\//i.test(uri) || uri.startsWith('file://') || uri.startsWith('asset://')) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return uri;
}

/** Writes chart style JSON to app documents; required for OfflineManager + offline Map. */
export async function ensureChartStyleFile(): Promise<string> {
  const dir = chartStyleDirectory();
  const fsPath = chartStyleFilesystemPath();
  const mapStyleUri = chartStyleFileUri();
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const spec = JSON.stringify(buildChartStyleSpec());
    const existing = await FileSystem.readAsStringAsync(fsPath).catch(() => null);
    if (existing !== spec) {
      await FileSystem.writeAsStringAsync(fsPath, spec);
    }
    const fileInfo = await FileSystem.getInfoAsync(fsPath);
    if (!fileInfo.exists) {
      throw new Error('chart style file missing after write');
    }
    return mapStyleUri;
  } catch (error) {
    console.error('[chartStyle] ensureChartStyleFile failed', error);
    throw error;
  }
}

export { MAP_ATTRIBUTION };
