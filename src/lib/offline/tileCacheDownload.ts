import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import { Dimensions, Platform } from 'react-native';

import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { yieldToUi } from '../async/yieldToUi';
import { tileSweepFinalSettleMs } from './downloadMapConstants';
import { downloadCoordinator } from './downloadCoordinator';
import {
  getDownloadMapGeneration,
  isLiveDownloadMapController,
  waitForDownloadMapController,
  waitForDownloadMapReady,
  type DownloadMapController,
} from './downloadMapHost';
import {
  ensureOfflineMapEngineReadyForDownload,
  offlineEngineViewportFromBounds,
} from './offlineMapEngineHost';
import { isVisibleDownloadMapSlot, waitForVisibleDownloadMapSlot } from './downloadMapSlot';
import { enumerateTileViewports, estimateDownloadViewportStride } from './tileGrid';

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

/**
 * Extra dwell after `waitForFrame` so ambient cache can flush the painted tiles.
 * Frame-ready already proves the GL surface painted — 450ms was overly conservative
 * (~2–3 min of pure idle on kiel-bay). 250ms keeps a safety margin without holes.
 */
const SETTLE_MS = process.env.NODE_ENV === 'test' ? 0 : 250;
const VISIBLE_SLOT_WAIT_MS = process.env.NODE_ENV === 'test' ? 250 : 45_000;
/** Floor for map-slot size when estimating how many tiles one camera hop paints. */
const DOWNLOAD_MAP_MIN_PX = 180;

/**
 * Camera hops can skip neighbour tiles when the visible download map is large enough
 * to paint them in one frame. Tests keep stride 1 so every tile is still centred.
 */
function resolveSweepStride(): { strideX: number; strideY: number } {
  if (process.env.NODE_ENV === 'test') {
    return { strideX: 1, strideY: 1 };
  }
  const { width, height } = Dimensions.get('window');
  // Chrome sits above the map (~half height reserved for GL); under-estimate to stay safe.
  const mapWidth = Math.max(DOWNLOAD_MAP_MIN_PX, width);
  const mapHeight = Math.max(DOWNLOAD_MAP_MIN_PX, height * 0.5);
  return estimateDownloadViewportStride(mapWidth, mapHeight);
}

function buildProgress(completed: number, total: number): TileSweepProgress {
  const percentage = total <= 0 ? 100 : Math.min(100, Math.round((completed / total) * 100));
  return { completed, total, percentage };
}

async function acquireLiveController(chartStyleUri: string): Promise<DownloadMapController> {
  const visible = await waitForVisibleDownloadMapSlot(VISIBLE_SLOT_WAIT_MS);
  if (!visible || !isVisibleDownloadMapSlot()) {
    throw new Error('DOWNLOAD_MAP_NOT_VISIBLE');
  }

  const mapReady = await waitForDownloadMapReady(chartStyleUri);
  if (!mapReady) {
    throw new Error('DOWNLOAD_MAP_NOT_READY');
  }

  const controller = await waitForDownloadMapController();
  if (!controller || !isLiveDownloadMapController(controller)) {
    throw new Error('DOWNLOAD_MAP_NOT_READY');
  }
  return controller;
}

/**
 * Loads every raster tile for the bounds (base + style overlays such as seamarks)
 * by actually displaying each tile viewport on the visible download map so MapLibre
 * stores them in the persistent ambient cache, then OfflineManager can seal them.
 *
 * Zoom-level-only center jumps are NOT enough — Android will not permanently keep
 * tiles that were never rendered.
 *
 * Controllers are re-acquired per tile so a Map↔Downloads remount cannot advance
 * progress on a dead camera (false Ready with holes).
 */
export async function runTileCacheSweep(options: TileCacheSweepOptions): Promise<TileSweepProgress> {
  const stride = resolveSweepStride();
  const viewports = enumerateTileViewports(options.bounds, options.minZoom, options.maxZoom, stride);
  const total = viewports.length;
  let completed = Math.min(Math.max(0, options.startIndex ?? 0), total);

  options.onProgress(buildProgress(completed, total));

  if (total === 0) {
    return buildProgress(0, 0);
  }

  if (Platform.OS === 'android' && downloadCoordinator.hasActiveDownload()) {
    const viewport = offlineEngineViewportFromBounds(options.bounds, options.minZoom);
    await ensureOfflineMapEngineReadyForDownload(options.chartStyleUri, viewport, options.bounds);
    await yieldToUi();
  }

  for (let index = completed; index < total; ) {
    if (options.isCancelled()) break;

    const controller = await acquireLiveController(options.chartStyleUri);
    const generation = getDownloadMapGeneration();
    ensureMapLibreNetworkForDownload();
    const tile = viewports[index]!;
    await controller.showTile(tile.center, tile.zoom);
    await yieldToUi();
    await controller.waitForFrame();
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    // Remount / generation bump mid-tile — do not count progress; retry same index.
    if (getDownloadMapGeneration() !== generation || !isLiveDownloadMapController(controller)) {
      continue;
    }

    completed = index + 1;
    index = completed;
    options.onProgress(buildProgress(completed, total));
  }

  if (options.isCancelled()) {
    return buildProgress(completed, total);
  }

  if (completed < total) {
    throw new Error('DOWNLOAD_SWEEP_INCOMPLETE');
  }

  // Final full-bounds frame so both layers settle for the seal camera.
  const sealController = await acquireLiveController(options.chartStyleUri);
  ensureMapLibreNetworkForDownload();
  await sealController.fitBounds(options.bounds, options.minZoom);
  await yieldToUi();
  await sealController.waitForFrame();
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
