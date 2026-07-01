import { useEffect, useMemo } from 'react';

import { useIsDeviceDisconnected } from '../lib/network/connectivity';
import { syncMapLibreNetworkState } from '../lib/network/mapLibreNetworkGate';
import { downloadCoordinator } from '../lib/offline/downloadCoordinator';
import { useOfflinePackStore } from '../store/offlinePackStore';

/**
 * Android: tell MapLibre Native to serve cached offline tiles instead of attempting network fetches.
 * Without this, airplane mode often shows blank charts even after a successful pack download.
 * Uses isConnected only — isInternetReachable false-positives would block tile downloads while online.
 * Keeps network enabled while a pack download session is active (coordinator, store lock, or downloading UI).
 * iOS native module is currently a no-op; offline packs still work via the system network stack.
 */
export function useMapLibreNetworkSync(): void {
  const disconnected = useIsDeviceDisconnected();
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const regions = useOfflinePackStore((s) => s.regions);
  const hasDownloadingRegion = useMemo(
    () => Object.values(regions).some((r) => r.state === 'downloading'),
    [regions],
  );

  useEffect(() => {
    const downloadActive =
      downloadCoordinator.hasActiveDownload() ||
      activeDownloadRegionId != null ||
      hasDownloadingRegion;
    syncMapLibreNetworkState(disconnected, downloadActive);
  }, [disconnected, activeDownloadRegionId, hasDownloadingRegion]);
}
