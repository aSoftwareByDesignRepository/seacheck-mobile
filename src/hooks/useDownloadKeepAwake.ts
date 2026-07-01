import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import { downloadCoordinator } from '../lib/offline/downloadCoordinator';
import { useOfflinePackStore } from '../store/offlinePackStore';

const TAG = 'seacheck-download';

/** Prevent screen sleep while a chart pack download session is active. */
export function useDownloadKeepAwake(): void {
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const hasDownloadingRegion = useOfflinePackStore((s) =>
    Object.values(s.regions).some((r) => r.state === 'downloading'),
  );

  useEffect(() => {
    const downloadActive =
      downloadCoordinator.hasActiveDownload() || activeDownloadRegionId != null || hasDownloadingRegion;
    if (!downloadActive) return;

    void activateKeepAwakeAsync(TAG);
    return () => {
      void deactivateKeepAwake(TAG);
    };
  }, [activeDownloadRegionId, hasDownloadingRegion]);
}
