import { OfflineManager } from '@maplibre/maplibre-react-native';

import { MAX_TILE_COUNT } from '../map/bounds';
import { AMBIENT_CACHE_MAX_BYTES } from './ambientCache';

let setupPromise: Promise<void> | null = null;

/** One-time native offline limits + ambient cache — must run before createPack. */
export async function ensureOfflineManagerConfigured(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      OfflineManager.setTileCountLimit(MAX_TILE_COUNT * 2);
      OfflineManager.setProgressEventThrottle(250);
      try {
        await OfflineManager.setMaximumAmbientCacheSize(AMBIENT_CACHE_MAX_BYTES);
      } catch (error) {
        console.warn('[offlineManagerSetup] ambient cache size failed', error);
      }
    })();
  }
  await setupPromise;
}

/** Test-only reset. */
export function resetOfflineManagerSetupForTests(): void {
  setupPromise = null;
}
