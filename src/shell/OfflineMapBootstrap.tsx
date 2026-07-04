import { OfflineMapEngineHost } from '../features/offline/OfflineMapEngineHost';
import { useMapLibreNetworkSync } from '../hooks/useMapLibreNetworkSync';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { useEffect } from 'react';

/**
 * Keeps the hidden Android map engine and MapLibre network state alive for the whole session —
 * not only while the Map tab is mounted (Downloads preflight needs this during boot recovery).
 */
export function OfflineMapBootstrap() {
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const ensureHydratedForUi = useOfflinePackStore((s) => s.ensureHydratedForUi);

  useMapLibreNetworkSync();

  useEffect(() => {
    if (!hydrated) {
      void ensureHydratedForUi();
    }
  }, [hydrated, ensureHydratedForUi]);

  return <OfflineMapEngineHost />;
}
