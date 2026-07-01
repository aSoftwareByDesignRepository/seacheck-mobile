import NetInfo from '@react-native-community/netinfo';

import { t } from '../../i18n';

import { assertChartTileReachability } from './chartTileReachability';

export { ensureMapLibreNetworkForDownload, syncMapLibreNetworkState } from './mapLibreNetworkGate';

/** Block downloads only when the device has no network interface (unknown reachability is allowed). */
export async function assertNetworkForDownload(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) {
    throw new Error(t('downloads.errorOffline'));
  }
}

/** NetInfo gate plus a live Carto tile fetch — fails fast before native download stalls. */
export async function assertChartDownloadNetworkReady(): Promise<void> {
  await assertNetworkForDownload();
  await assertChartTileReachability();
}
