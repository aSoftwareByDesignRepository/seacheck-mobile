import { useEffect, useRef } from 'react';

import { isPackDownloadActive } from '../features/downloads/packDownloadPresentation';
import { reportDownloadFailure } from '../lib/offline/reportDownloadFailure';
import { useOfflinePackStore } from '../store/offlinePackStore';

function failureSignature(state: string, error: string | null | undefined): string | null {
  if (state === 'error') return error?.trim() || '__error__';
  if (state === 'ready' && error?.trim()) return error.trim();
  return null;
}

/** Modal when a pack transitions to a visible download failure (not on initial hydrate). */
export function useDownloadFailureAlerts() {
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const knownFailuresRef = useRef<Record<string, string>>({});
  const seededRef = useRef(false);

  useEffect(() => {
    if (!hydrated) {
      seededRef.current = false;
      knownFailuresRef.current = {};
      return;
    }

    const seedKnownFailures = (regions: ReturnType<typeof useOfflinePackStore.getState>['regions']) => {
      const snapshot: Record<string, string> = {};
      for (const [regionId, status] of Object.entries(regions)) {
        const sig = failureSignature(status.state, status.error);
        if (sig) snapshot[regionId] = sig;
      }
      knownFailuresRef.current = snapshot;
      seededRef.current = true;
    };

    seedKnownFailures(useOfflinePackStore.getState().regions);

    return useOfflinePackStore.subscribe((state, prev) => {
      if (!state.hydrated) return;

      if (!seededRef.current) {
        seedKnownFailures(state.regions);
        return;
      }

      const prevActiveId = prev.activeDownloadRegionId;

      for (const [regionId, status] of Object.entries(state.regions)) {
        const sig = failureSignature(status.state, status.error);
        if (!sig) {
          if (knownFailuresRef.current[regionId]) delete knownFailuresRef.current[regionId];
          continue;
        }

        const known = knownFailuresRef.current[regionId];
        if (known === sig) continue;

        const wasDownloading =
          prev.regions[regionId]?.state === 'downloading' ||
          prevActiveId === regionId ||
          isPackDownloadActive(regionId, prev.regions[regionId] ?? { state: 'idle' }, prevActiveId);

        knownFailuresRef.current[regionId] = sig;

        if (!wasDownloading && known != null) continue;

        void reportDownloadFailure({
          regionId,
          message: status.error?.trim() || 'Download failed',
          source: 'async',
        });
      }
    });
  }, [hydrated]);
}
