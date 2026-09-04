import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { yieldToUi } from '../async/yieldToUi';
import { tileSweepFinalSettleMs } from './downloadMapConstants';
import { downloadCoordinator } from './downloadCoordinator';
import { waitForDownloadMapReady, waitForDownloadMapController } from './downloadMapHost';
import {
  ensureOfflineMapEngineReadyForDownload,
  offlineEngineViewportFromBounds,
} from './offlineMapEngineHost';

export type TileSweepProgress = {
  completed: number;
  total: number;
  percentage: number;
};

export type TileCacheSweepOptions = {
  chartStyleUri: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
  startIndex?: number;
  isCancelled: () => boolean;
  onProgress: (progress: TileSweepProgress) => void;
};

const SETTLE_MS = process.env.NODE_ENV === 'test' ? 0 : 450;

function buildProgress(completed: number, total: number): TileSweepProgress {
  const percentage = total <= 0 ? 100 : Math.min(100, Math.round((completed / total) * 100));
  return { completed, total, percentage };
}

function zoomLevels(minZoom: number, maxZoom: number): number[] {
  const levels: number[] = [];
  for (let z = minZoom; z <= maxZoom; z++) levels.push(z);
  return levels;
}

/**
 * Loads every zoom level for the bounds with the visible download map so MapLibre
 * stores raster tiles in the persistent ambient cache (survives app restarts).
 */
export async function runTileCacheSweep(options: TileCacheSweepOptions): Promise<TileSweepProgress> {
  const levels = zoomLevels(options.minZoom, options.maxZoom);
  const total = levels.length;
  let completed = Math.min(options.startIndex ?? 0, total);

  options.onProgress(buildProgress(completed, total));

  if (Platform.OS === 'android' && downloadCoordinator.hasActiveDownload()) {
    const viewport = offlineEngineViewportFromBounds(options.bounds, options.minZoom);
    await ensureOfflineMapEngineReadyForDownload(options.chartStyleUri, viewport, options.bounds);
    await yieldToUi();
  }

  const mapReady = await waitForDownloadMapReady(options.chartStyleUri);
  if (!mapReady) {
    throw new Error('DOWNLOAD_MAP_NOT_READY');
  }

  const controller = await waitForDownloadMapController();
  if (!controller) {
    throw new Error('DOWNLOAD_MAP_NOT_READY');
  }

  for (let index = completed; index < total; index++) {
    if (options.isCancelled()) break;
    ensureMapLibreNetworkForDownload();
    await controller.fitBounds(options.bounds, levels[index]!);
    await yieldToUi();
    await controller.waitForFrame();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    completed = index + 1;
    options.onProgress(buildProgress(completed, total));
  }

  if (options.isCancelled()) {
    return buildProgress(completed, total);
  }

  if (completed < total) {
    throw new Error('DOWNLOAD_SWEEP_INCOMPLETE');
  }

  await yieldToUi();
  await new Promise((resolve) => setTimeout(resolve, tileSweepFinalSettleMs()));

  return buildProgress(completed, total);
}

/** Stable id for cache-backed regions — no native OfflineManager pack. */
export function cacheBackedPackId(regionId: string): string {
  return `cache:${regionId}`;
}

export function isCacheBackedPackId(packId: string | null | undefined): boolean {
  return typeof packId === 'string' && packId.startsWith('cache:');
}

const REDOWNLOAD_PACK_PREFIX = 'redownload:';

/** Placeholder after basemap migration — custom region kept for one-tap re-download. */
export function redownloadPlaceholderPackId(regionId: string): string {
  return `${REDOWNLOAD_PACK_PREFIX}${regionId}`;
}

export function isRedownloadPlaceholderPackId(packId: string | null | undefined): boolean {
  return typeof packId === 'string' && packId.startsWith(REDOWNLOAD_PACK_PREFIX);
}

/** True when packId is a real MapLibre offline pack (not cache: / redownload: placeholders). */
export function isNativeOfflinePackId(packId: string | null | undefined): packId is string {
  return (
    typeof packId === 'string' &&
    packId.length > 0 &&
    !isCacheBackedPackId(packId) &&
    !isRedownloadPlaceholderPackId(packId)
  );
}
