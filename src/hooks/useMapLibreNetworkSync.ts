import { useEffect, useMemo, useState } from 'react';

import { useIsDeviceDisconnected } from '../lib/network/connectivity';
import { ensureMapLibreNetworkForDownload, syncMapLibreNetworkState } from '../lib/network/mapLibreNetworkGate';
import { downloadCoordinator, subscribeDownloadCoordinatorActivity } from '../lib/offline/downloadCoordinator';
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
  const [coordinatorTick, setCoordinatorTick] = useState(0);
  const hasDownloadingRegion = useMemo(
    () => Object.values(regions).some((r) => r.state === 'downloading'),
    [regions],
  );

  useEffect(() => subscribeDownloadCoordinatorActivity(() => setCoordinatorTick((n) => n + 1)), []);

  const downloadActive =
    downloadCoordinator.hasActiveDownload() ||
    activeDownloadRegionId != null ||
    hasDownloadingRegion;

  useEffect(() => {
    syncMapLibreNetworkState(disconnected, downloadActive);
  }, [disconnected, downloadActive, coordinatorTick]);

  /** Belt-and-suspenders: native tile fetches must stay online for the whole download session. */
  useEffect(() => {
    if (!downloadActive) return;
    ensureMapLibreNetworkForDownload();
    const interval = setInterval(() => ensureMapLibreNetworkForDownload(), 2_000);
    return () => clearInterval(interval);
  }, [downloadActive, coordinatorTick]);
}
