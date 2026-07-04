import { Platform } from 'react-native';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import { promiseWithTimeout, TimeoutError } from '../async/promiseWithTimeout';
import { yieldToUi } from '../async/yieldToUi';
import { ensureOfflineManagerConfigured } from './offlineManagerSetup';
import {
  ensureOfflineMapEnginePrimedBeforeDownload,
  waitForOfflineMapEngineStyle,
} from './offlineMapEngineHost';
import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';

export type WarmupOfflineEngineOptions = {
  /** When true (default on Android), throw if the map engine never parses the style. */
  requireStyleLoaded?: boolean;
  /** Per-call timeout for native pack listing — boot must never hang on MapLibre. */
  getPacksTimeoutMs?: number;
  /** When true, a getPacks timeout is fatal (download paths). Boot hydrate keeps this false. */
  requireFileSource?: boolean;
};

const DEFAULT_GET_PACKS_TIMEOUT_MS = 8_000;

/** Activate native file source + tile limits before createPack (Android needs this). */
export async function warmupOfflineEngine(
  chartStyleUri?: string,
  options?: WarmupOfflineEngineOptions,
): Promise<void> {
  ensureOfflineManagerConfigured();
  ensureMapLibreNetworkForDownload();
  const getPacksTimeoutMs = options?.getPacksTimeoutMs ?? DEFAULT_GET_PACKS_TIMEOUT_MS;
  const requireFileSource = options?.requireFileSource ?? false;
  try {
    await promiseWithTimeout(OfflineManager.getPacks(), getPacksTimeoutMs, 'OfflineManager.getPacks');
  } catch (error) {
    if (error instanceof TimeoutError) {
      const message = '[warmupOfflineEngine] native pack listing timed out';
      if (requireFileSource) {
        throw new Error(message);
      }
      console.warn(message);
    } else {
      throw error;
    }
  }
  if (!chartStyleUri) return;

  const requireStyleLoaded = options?.requireStyleLoaded ?? Platform.OS === 'android';
  if (requireStyleLoaded) {
    await yieldToUi();
    await ensureOfflineMapEnginePrimedBeforeDownload(chartStyleUri);
    return;
  }

  const styleReady = await waitForOfflineMapEngineStyle(chartStyleUri);
  if (!styleReady) {
    console.warn('[warmupOfflineEngine] chart style not loaded by map engine host');
  }
}
