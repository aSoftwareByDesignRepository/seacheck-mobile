import { assertChartDownloadNetworkReady } from '../network/downloadNetwork';
import type { LonLatPoint } from '../map/bounds';
import { resolveChartTileProbeCenter } from '../network/chartTileProbeCenter';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { yieldToUi } from '../async/yieldToUi';

import { ensureOfflineMapEngineReadyForDownload } from './offlineMapEngineHost';
import { warmupOfflineEngine } from './warmupOfflineEngine';
import { resolveOfflineEngineCamera } from './resolveOfflineEngineCamera';

/** Shared preflight before any chart tile download (region or custom). */
export async function prepareChartDownload(
  ensureChartStyle: () => Promise<string>,
  regionId?: string,
  probeCenterOverride?: LonLatPoint,
): Promise<string> {
  const probeCenter =
    probeCenterOverride ??
    resolveChartTileProbeCenter(regionId, useOfflinePackStore.getState().customBoundsIndex);
  await assertChartDownloadNetworkReady(probeCenter);
  const chartStyleUri = await ensureChartStyle();
  await yieldToUi();
  await warmupOfflineEngine(chartStyleUri, { requireStyleLoaded: false, requireFileSource: true });
  const store = useOfflinePackStore.getState();
  const viewport = resolveOfflineEngineCamera(regionId ?? null, store.customBoundsIndex);
  await ensureOfflineMapEngineReadyForDownload(chartStyleUri, viewport);
  return chartStyleUri;
}
