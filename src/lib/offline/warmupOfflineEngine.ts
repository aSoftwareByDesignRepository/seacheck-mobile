import { OfflineManager } from '@maplibre/maplibre-react-native';

import { ensureOfflineManagerConfigured } from './offlineManagerSetup';
import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';

/** Activate native file source + tile limits before createPack (Android needs this). */
export async function warmupOfflineEngine(): Promise<void> {
  ensureOfflineManagerConfigured();
  ensureMapLibreNetworkForDownload();
  await OfflineManager.getPacks();
}
