import { NetworkManager } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

/**
 * Android MapLibre must be told when to use cache vs network.
 * When the device has no connection (airplane mode), setConnected(false) serves ambient + offline-pack tiles.
 * Ignores isInternetReachable — Android often reports false negatives while Wi‑Fi works.
 * Downloads always force online so tile fetches keep working.
 */
export function syncMapLibreNetworkState(deviceDisconnected: boolean, downloadActive: boolean): void {
  if (Platform.OS !== 'android') return;
  NetworkManager.setConnected(downloadActive || !deviceDisconnected);
}

/** Force MapLibre native online — call before createPack, resume, and during preflight. */
export function ensureMapLibreNetworkForDownload(): void {
  if (Platform.OS !== 'android') return;
  NetworkManager.setConnected(true);
}
