import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

import { t } from '../../i18n';
import { boundsCenter } from '../map/bounds';
import { yieldToUi } from '../async/yieldToUi';

const STYLE_LOAD_TIMEOUT_MS = 20_000;
const STYLE_ENSURE_ATTEMPTS = 4;
const STYLE_RELOAD_SETTLE_MS = 350;
const VIEWPORT_PRIME_TIMEOUT_MS = 18_000;
const VIEWPORT_PRIME_ATTEMPTS = 3;
const VIEWPORT_CENTER_EPSILON = 0.02;
const VIEWPORT_ZOOM_EPSILON = 0.75;

export type OfflineEngineViewport = {
  center: [number, number];
  zoom: number;
};

let loadedStyleUri: string | null = null;
/** Matches `styleReloadNonce` when the hidden engine last confirmed style + render. */
let loadedStyleGeneration = -1;
let styleReloadNonce = 0;
let styleWaiters: Array<(ready: boolean) => void> = [];
const reloadListeners = new Set<() => void>();

let pendingViewport: OfflineEngineViewport | null = null;
let primedViewport: OfflineEngineViewport | null = null;
/** Visible download map on the Downloads screen — reliable tile enumeration on Android. */
let foregroundPrimedViewport: OfflineEngineViewport | null = null;
let viewportGeneration = 0;
let viewportWaiters: Array<(ready: boolean) => void> = [];
const viewportListeners = new Set<() => void>();

const FOREGROUND_MAP_WAIT_MS = 14_000;

function viewportMatches(a: OfflineEngineViewport, b: OfflineEngineViewport): boolean {
  return (
    Math.abs(a.center[0] - b.center[0]) <= VIEWPORT_CENTER_EPSILON &&
    Math.abs(a.center[1] - b.center[1]) <= VIEWPORT_CENTER_EPSILON &&
    Math.abs(a.zoom - b.zoom) <= VIEWPORT_ZOOM_EPSILON
  );
}

function notifyViewportListeners(): void {
  viewportListeners.forEach((listener) => listener());
}

/** Build a hidden-map camera target from offline pack bounds. */
export function offlineEngineViewportFromBounds(bounds: LngLatBounds, minZoom = 10): OfflineEngineViewport {
  const center = boundsCenter(bounds);
  return { center: [center.longitude, center.latitude], zoom: minZoom };
}

/**
 * Called only from the hidden OfflineMapEngineHost once style is parsed and the map has rendered.
 * `generation` must match the current reload nonce — stale callbacks from unmounted maps are ignored.
 */
export function markOfflineMapEngineStyleLoaded(styleUri: string, generation = styleReloadNonce): void {
  if (generation !== styleReloadNonce) return;
  loadedStyleUri = styleUri;
  loadedStyleGeneration = generation;
  const waiters = styleWaiters;
  styleWaiters = [];
  waiters.forEach((resolve) => resolve(true));
}

export function markOfflineMapEngineStyleFailed(styleUri: string, generation = styleReloadNonce): void {
  if (generation !== styleReloadNonce) return;
  if (loadedStyleUri === styleUri && loadedStyleGeneration === generation) {
    loadedStyleUri = null;
    loadedStyleGeneration = -1;
  }
  const waiters = styleWaiters;
  styleWaiters = [];
  waiters.forEach((resolve) => resolve(false));
}

/** Bump to remount the hidden map host — used when style load stalls on Android. */
export function requestOfflineMapEngineStyleReload(): void {
  loadedStyleUri = null;
  loadedStyleGeneration = -1;
  styleReloadNonce += 1;
  reloadListeners.forEach((listener) => listener());
}

export function subscribeOfflineMapEngineStyleReload(listener: () => void): () => void {
  reloadListeners.add(listener);
  return () => reloadListeners.delete(listener);
}

export function getOfflineMapEngineStyleReloadNonce(): number {
  return styleReloadNonce;
}

export function resetOfflineMapEngineHostForTests(): void {
  loadedStyleUri = null;
  loadedStyleGeneration = -1;
  styleReloadNonce = 0;
  styleWaiters = [];
  reloadListeners.clear();
  pendingViewport = null;
  primedViewport = null;
  viewportGeneration = 0;
  viewportWaiters = [];
  viewportListeners.clear();
}

export function subscribeOfflineMapEngineViewport(listener: () => void): () => void {
  viewportListeners.add(listener);
  return () => viewportListeners.delete(listener);
}

export function getPendingOfflineMapEngineViewport(): OfflineEngineViewport | null {
  return pendingViewport;
}

export function getOfflineMapEngineViewportGeneration(): number {
  return viewportGeneration;
}

/** True when the hidden map rendered at least one frame for the given viewport. */
export function isOfflineMapEngineViewportPrimed(viewport: OfflineEngineViewport): boolean {
  return primedViewport != null && viewportMatches(primedViewport, viewport);
}

/**
 * Aim the hidden map at the download viewport so raster sources initialize before tile enumeration.
 */
export function requestOfflineMapEngineViewport(viewport: OfflineEngineViewport): void {
  pendingViewport = viewport;
  primedViewport = null;
  viewportGeneration += 1;
  notifyViewportListeners();
}

/**
 * Called from OfflineMapEngineHost after the camera reaches the pending viewport and renders.
 */
export function markOfflineMapEngineViewportPrimed(
  viewport: OfflineEngineViewport,
  generation = viewportGeneration,
): void {
  if (generation !== viewportGeneration) return;
  if (!pendingViewport || !viewportMatches(pendingViewport, viewport)) return;
  primedViewport = viewport;
  const waiters = viewportWaiters;
  viewportWaiters = [];
  waiters.forEach((resolve) => resolve(true));
}

async function waitForOfflineMapEngineViewport(
  viewport: OfflineEngineViewport,
  timeoutMs = VIEWPORT_PRIME_TIMEOUT_MS,
): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (isOfflineMapEngineViewportPrimed(viewport)) return true;

  const waitGeneration = viewportGeneration;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      viewportWaiters = viewportWaiters.filter((w) => w !== onReady);
      resolve(isOfflineMapEngineViewportPrimed(viewport) && viewportGeneration === waitGeneration);
    }, timeoutMs);

    const onReady = (ready: boolean) => {
      clearTimeout(timer);
      resolve(ready && isOfflineMapEngineViewportPrimed(viewport) && viewportGeneration === waitGeneration);
    };

    viewportWaiters.push(onReady);
  });
}

/**
 * Move the hidden map to the download viewport and wait for a rendered frame.
 * Required on Android before OfflineManager can enumerate tiles beyond the style resource.
 */
export async function ensureOfflineMapEngineViewportPrimed(
  styleUri: string,
  viewport: OfflineEngineViewport,
  timeoutMs = VIEWPORT_PRIME_TIMEOUT_MS,
): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (!isOfflineMapEngineStyleLoaded(styleUri)) return false;
  if (isOfflineMapEngineViewportPrimed(viewport)) return true;

  for (let attempt = 0; attempt < VIEWPORT_PRIME_ATTEMPTS; attempt++) {
    requestOfflineMapEngineViewport(viewport);
    await yieldToUi();
    await new Promise((resolve) => setTimeout(resolve, STYLE_RELOAD_SETTLE_MS));
    const ready = await waitForOfflineMapEngineViewport(viewport, timeoutMs);
    if (ready) return true;
  }

  return isOfflineMapEngineViewportPrimed(viewport);
}

/** True when the hidden Android map engine parsed the style and rendered at least one frame. */
export function isOfflineMapEngineStyleLoaded(styleUri: string): boolean {
  return loadedStyleUri === styleUri && loadedStyleGeneration === styleReloadNonce;
}

/**
 * Android offline packs can stall at requiredResourceCount=1 when no MapLibre map
 * instance has parsed the on-disk style (main map tab may be detached).
 */
export async function waitForOfflineMapEngineStyle(
  styleUri: string,
  timeoutMs = STYLE_LOAD_TIMEOUT_MS,
): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (isOfflineMapEngineStyleLoaded(styleUri)) return true;

  const waitGeneration = styleReloadNonce;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      styleWaiters = styleWaiters.filter((w) => w !== onReady);
      resolve(isOfflineMapEngineStyleLoaded(styleUri) && loadedStyleGeneration === waitGeneration);
    }, timeoutMs);

    const onReady = (ready: boolean) => {
      clearTimeout(timer);
      resolve(ready && isOfflineMapEngineStyleLoaded(styleUri) && loadedStyleGeneration === waitGeneration);
    };

    styleWaiters.push(onReady);
  });
}

/**
 * Wait for the hidden map engine to parse the chart style and render.
 * Retries with host remounts — required before OfflineManager can enumerate tiles on Android.
 */
export async function ensureOfflineMapEngineStyle(styleUri: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (isOfflineMapEngineStyleLoaded(styleUri)) return;

  for (let attempt = 0; attempt < STYLE_ENSURE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      requestOfflineMapEngineStyleReload();
      await yieldToUi();
      await new Promise((resolve) => setTimeout(resolve, STYLE_RELOAD_SETTLE_MS));
    } else {
      await yieldToUi();
    }
    const ready = await waitForOfflineMapEngineStyle(styleUri);
    if (ready) return;
  }

  throw new Error(t('downloads.errorMapEngineStyle'));
}

/**
 * Remount the hidden map and wait until it is ready for offline tile enumeration.
 * Skips work when the current host generation is already primed for this style.
 */
export async function ensureOfflineMapEnginePrimedBeforeDownload(styleUri: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (isOfflineMapEngineStyleLoaded(styleUri)) return;

  requestOfflineMapEngineStyleReload();
  await yieldToUi();
  await new Promise((resolve) => setTimeout(resolve, STYLE_RELOAD_SETTLE_MS));
  await ensureOfflineMapEngineStyle(styleUri);
}

/**
 * Full Android priming: style parsed + hidden map rendered at the download viewport.
 * Always re-aims the camera — style-loaded alone is not enough for tile enumeration.
 */
export async function ensureOfflineMapEngineReadyForDownload(
  styleUri: string,
  viewport: OfflineEngineViewport,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  await ensureOfflineMapEnginePrimedBeforeDownload(styleUri);
  if (!isOfflineMapEngineStyleLoaded(styleUri)) {
    await ensureOfflineMapEngineStyle(styleUri);
  }

  let viewportReady = await ensureOfflineMapEngineViewportPrimed(styleUri, viewport);
  if (viewportReady) return;

  requestOfflineMapEngineStyleReload();
  await yieldToUi();
  await new Promise((resolve) => setTimeout(resolve, STYLE_RELOAD_SETTLE_MS));
  await ensureOfflineMapEngineStyle(styleUri);
  viewportReady = await ensureOfflineMapEngineViewportPrimed(styleUri, viewport, VIEWPORT_PRIME_TIMEOUT_MS * 2);
  if (!viewportReady) {
    throw new Error(t('downloads.errorMapEngineStyle'));
  }
}
