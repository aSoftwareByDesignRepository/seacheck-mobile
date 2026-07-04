import { Platform } from 'react-native';

import { t } from '../../i18n';
import { yieldToUi } from '../async/yieldToUi';

const STYLE_LOAD_TIMEOUT_MS = 20_000;
const STYLE_ENSURE_ATTEMPTS = 4;
const STYLE_RELOAD_SETTLE_MS = 350;

let loadedStyleUri: string | null = null;
/** Matches `styleReloadNonce` when the hidden engine last confirmed style + render. */
let loadedStyleGeneration = -1;
let styleReloadNonce = 0;
let styleWaiters: Array<(ready: boolean) => void> = [];
const reloadListeners = new Set<() => void>();

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
