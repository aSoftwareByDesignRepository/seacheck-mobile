import { LogManager } from '@maplibre/maplibre-react-native';

let configured = false;

/** Suppress noisy Mbgl tile timeout logs when OpenSeaMap/CARTO tiles are slow or unavailable. */
export function configureMapLogging(): void {
  if (configured) return;
  configured = true;

  LogManager.start();
  LogManager.onLog((event) => {
    if (event.level !== 'error') return false;
    if (event.message.includes('Failed to load tile') && event.message.includes('timeout')) {
      return true;
    }
    return false;
  });
}
