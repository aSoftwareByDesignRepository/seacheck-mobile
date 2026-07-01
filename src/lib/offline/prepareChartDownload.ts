import { assertChartDownloadNetworkReady } from '../network/downloadNetwork';

import { warmupOfflineEngine } from './warmupOfflineEngine';

/** Shared preflight before any chart tile download (region or custom). */
export async function prepareChartDownload(ensureChartStyle: () => Promise<string>): Promise<string> {
  await assertChartDownloadNetworkReady();
  await warmupOfflineEngine();
  return ensureChartStyle();
}
