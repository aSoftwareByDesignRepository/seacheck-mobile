import NetInfo from '@react-native-community/netinfo';

import { t } from '../../i18n';

import { assertChartTileReachability } from './chartTileReachability';
import type { LonLatPoint } from '../map/bounds';
import { ensureMapLibreNetworkForDownload } from './mapLibreNetworkGate';

export { ensureMapLibreNetworkForDownload, syncMapLibreNetworkState } from './mapLibreNetworkGate';

/** Block downloads only when the device has no network interface (unknown reachability is allowed). */
export async function assertNetworkForDownload(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) {
    throw new Error(t('downloads.errorOffline'));
  }
}

/** NetInfo gate plus live Carto + OpenSeaMap tile fetches — fails fast before native download stalls. */
export async function assertChartDownloadNetworkReady(probeCenter?: LonLatPoint): Promise<void> {
  ensureMapLibreNetworkForDownload();
  await assertNetworkForDownload();
  await assertChartTileReachability(fetch, probeCenter);
}
