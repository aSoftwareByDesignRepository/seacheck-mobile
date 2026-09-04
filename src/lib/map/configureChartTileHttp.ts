import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';

const USER_AGENT_HEADER_ID = 'seacheck-chart-tiles';
const APP_CONTACT_URL = 'https://software-by-design.de/seacheck';

let configured = false;

/** User-Agent string identifying SeaCheck for OSM / OpenSeaMap tile policy compliance. */
export function buildChartTileUserAgent(): string {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  return `SeaCheck/${version} (+${APP_CONTACT_URL})`;
}

/**
 * MapLibre Native on Android sends a generic OkHttp User-Agent unless we override it.
 * OSM returns a solid-colour placeholder tile (#aad3df) for unidentified clients — which
 * looks like “no tiles” on top of our chart background.
 */
export function configureChartTileHttp(): void {
  if (configured) return;
  configured = true;

  TransformRequestManager.addHeader({
    id: USER_AGENT_HEADER_ID,
    name: 'User-Agent',
    value: buildChartTileUserAgent(),
  });
}

/** Test-only reset. */
export function resetChartTileHttpForTests(): void {
  configured = false;
  TransformRequestManager.removeHeader(USER_AGENT_HEADER_ID);
}
