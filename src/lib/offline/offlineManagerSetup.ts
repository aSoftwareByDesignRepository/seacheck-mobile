import { OfflineManager } from '@maplibre/maplibre-react-native';

import { MAX_TILE_COUNT } from '../map/bounds';

let configured = false;

/** One-time native offline limits — must run before createPack. */
export function ensureOfflineManagerConfigured(): void {
  if (configured) return;
  configured = true;
  // Style JSON + two raster sources can exceed raw tile count; keep headroom under our app budget.
  OfflineManager.setTileCountLimit(MAX_TILE_COUNT * 2);
  OfflineManager.setProgressEventThrottle(250);
}

/** Test-only reset. */
export function resetOfflineManagerSetupForTests(): void {
  configured = false;
}
