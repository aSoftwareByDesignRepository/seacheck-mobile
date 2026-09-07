import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { MAP_ATTRIBUTION } from './constants';
import {
  CHART_BASE_ATTRIBUTION,
  CHART_BASE_TILE_URLS,
  CHART_SEAMARK_ATTRIBUTION,
  SEAMARK_TILE_URL,
} from '../lib/settings/chartBaseStyle';

export const CHART_STYLE_FILENAME = 'chart-style.json';

/**
 * Android OfflineManager.createPack feeds mapStyle through the HTTP stack.
 * `file://` / `asset://` then fail with "Unable to parse resourceUrl" and the pack
 * stays at 0% forever. ChartStyleLocalServer serves the bundled style on loopback.
 * MapView keeps using the documents `file://` copy from ensureChartStyleFile().
 */
export const ANDROID_OFFLINE_PACK_STYLE_URI = 'http://127.0.0.1:18765/chart-style.json';

export type ChartLayerVisibility = {
  base: boolean;
  seamarks: boolean;
};

/** MapLibre style with OSM base + OpenSeaMap seamark raster sources. */
export function buildChartStyleSpec(): StyleSpecification {
  return {
    version: 8,
    name: 'SeaCheck Chart',
    sources: {
      'osm-base': {
        type: 'raster',
        tiles: [...CHART_BASE_TILE_URLS],
        tileSize: 256,
        maxzoom: 19,
        attribution: CHART_BASE_ATTRIBUTION,
      },
      'openseamap-seamarks': {
        type: 'raster',
        tiles: [SEAMARK_TILE_URL],
        tileSize: 256,
        maxzoom: 18,
        attribution: CHART_SEAMARK_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#aad3df' },
      },
      {
        id: 'osm-base-layer',
        type: 'raster',
        source: 'osm-base',
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

/**
 * Style URI for OfflineManager.createPack / recreate.
 * Android must not use documents file:// (HTTP parser rejects it).
 */
export function offlinePackMapStyleUri(documentStyleUri: string): string {
  if (Platform.OS === 'android') {
    return ANDROID_OFFLINE_PACK_STYLE_URI;
  }
  return documentStyleUri;
}

/**
 * Fail fast if the Android loopback chart-style server is down before createPack.
 * iOS / non-HTTP styles are a no-op.
 */
export async function ensureOfflinePackStyleReachable(documentStyleUri: string): Promise<void> {
  const packStyleUri = offlinePackMapStyleUri(documentStyleUri);
  if (!/^https?:\/\//i.test(packStyleUri)) return;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller != null
      ? setTimeout(() => {
          controller.abort();
        }, 3_000)
      : null;
  try {
    const response = await fetch(packStyleUri, {
      method: 'GET',
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`OFFLINE_STYLE_UNREACHABLE:${response.status}`);
    }
    // Ensure body is actually JSON-ish (not an empty proxy error page).
    const text = await response.text();
    if (!text.includes('"version"') || !text.includes('osm-base')) {
      throw new Error('OFFLINE_STYLE_INVALID');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OFFLINE_STYLE_UNREACHABLE:timeout');
    }
    throw error instanceof Error ? error : new Error('OFFLINE_STYLE_UNREACHABLE');
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

/** Writes chart style JSON to app documents; required for MapView + iOS OfflineManager. */
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
