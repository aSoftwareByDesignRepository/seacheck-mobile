import { useMemo, useSyncExternalStore } from 'react';

import {
  hasExclusiveChartDownloadMap,
  isDownloadMapSessionActive,
} from '../features/downloads/packDownloadPresentation';
import {
  downloadCoordinator,
  subscribeDownloadCoordinatorActivity,
} from '../lib/offline/downloadCoordinator';
import { useOfflinePackStore } from '../store/offlinePackStore';

/**
 * Snapshot that changes when preflight → active or teardown flips.
 * Store `activeDownloadRegionId` alone is not enough: tryBegin clears preflightOnly
 * without rewriting the store, and exclusive UI must mount in the same tick NavigationMap yields.
 */
function getDownloadCoordinatorExclusiveEpoch(): string {
  return [
    downloadCoordinator.getActiveRegionId() ?? '',
    downloadCoordinator.getTeardownRegionId() ?? '',
    downloadCoordinator.isPreflightOnly() ? '1' : '0',
  ].join('|');
}

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
  const coordinatorEpoch = useSyncExternalStore(
    subscribeDownloadCoordinatorActivity,
    getDownloadCoordinatorExclusiveEpoch,
    getDownloadCoordinatorExclusiveEpoch,
  );

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
  }, [activeDownloadRegionId, downloadMapTeardownRegionId, activeState, coordinatorEpoch]);
}
