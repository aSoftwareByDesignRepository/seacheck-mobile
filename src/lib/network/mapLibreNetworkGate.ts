import { NetworkManager } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

/** Android MapLibre must be explicitly online for offline-pack tile fetches. */
export function syncMapLibreNetworkState(disconnected: boolean, downloadActive: boolean): void {
  if (Platform.OS !== 'android') return;
  NetworkManager.setConnected(downloadActive || !disconnected);
}

/** Force MapLibre native online — call before createPack, resume, and during preflight. */
export function ensureMapLibreNetworkForDownload(): void {
  if (Platform.OS !== 'android') return;
  NetworkManager.setConnected(true);
}
