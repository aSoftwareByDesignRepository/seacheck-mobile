import NetInfo from '@react-native-community/netinfo';

import { t } from '../../i18n';

import { assertChartTileReachability } from './chartTileReachability';
import type { LonLatPoint } from '../map/bounds';
import { fetchNetInfoState } from './connectivity';
import { ensureMapLibreNetworkForDownload } from './mapLibreNetworkGate';

export { ensureMapLibreNetworkForDownload, syncMapLibreNetworkState } from './mapLibreNetworkGate';

/**
 * Block downloads when the device has no network interface, or when NetInfo never answers.
 * Unknown reachability is still allowed (tile probe catches captive portals next).
 */
export async function assertNetworkForDownload(): Promise<void> {
  const state = await fetchNetInfoState();
  if (!state || state.isConnected === false) {
    throw new Error(t('downloads.errorOffline'));
  }
}

/** NetInfo gate plus live OpenSeaMap base + seamark tile fetches — fails fast before native download stalls. */
export async function assertChartDownloadNetworkReady(probeCenter?: LonLatPoint): Promise<void> {
  ensureMapLibreNetworkForDownload();
  await assertNetworkForDownload();
  await assertChartTileReachability(fetch, probeCenter);
}
