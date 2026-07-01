import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { prepareChartDownload } from './prepareChartDownload';

/**
 * Holds the download coordinator lock during async preflight so Android MapLibre
 * stays online while chart style and offline engine warmup run.
 */
export async function runLockedChartDownloadPreflight(
  regionId: string,
  ensureChartStyle: () => Promise<string>,
): Promise<void> {
  if (!useOfflinePackStore.getState().preflightDownloadLock(regionId)) {
    throw new Error(t('downloads.errorDownloadBusy'));
  }
  try {
    await prepareChartDownload(ensureChartStyle);
  } catch (error) {
    useOfflinePackStore.getState().releasePreflightDownloadLock(regionId);
    throw error;
  }
}
