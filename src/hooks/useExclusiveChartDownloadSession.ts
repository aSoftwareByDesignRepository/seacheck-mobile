import { useMemo } from 'react';

import {
  hasExclusiveChartDownloadMap,
  isDownloadMapSessionActive,
} from '../features/downloads/packDownloadPresentation';
import { useOfflinePackStore } from '../store/offlinePackStore';

/**
 * True while DownloadMapEngine owns the sole MapLibre GL context (tile sweep + finalize + teardown).
 * Other chart surfaces must unmount during this window — multiple GL maps on Android OOM/crash.
 */
export function useExclusiveChartDownloadSession(): boolean {
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const activeState = useOfflinePackStore((s) => {
    const regionId = s.activeDownloadRegionId ?? s.downloadMapTeardownRegionId;
    return regionId != null ? s.regions[regionId]?.state : undefined;
  });

  return useMemo(() => {
    if (!hasExclusiveChartDownloadMap(activeDownloadRegionId, downloadMapTeardownRegionId)) return false;
    const regionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
    if (!regionId) return false;
    return isDownloadMapSessionActive(
      regionId,
      { state: activeState ?? 'idle' },
      activeDownloadRegionId,
      downloadMapTeardownRegionId,
    );
  }, [activeDownloadRegionId, downloadMapTeardownRegionId, activeState]);
}
