import { useCallback, useState } from 'react';

import { ensureDownloadAllowed } from '../lib/network/downloadPolicy';
import { runLockedChartDownloadPreflight } from '../lib/offline/downloadPreflight';
import { reportDownloadFailureFromError } from '../lib/offline/reportDownloadFailure';
import { reportDownloadOutcome } from '../lib/offline/reportDownloadOutcome';
import { waitForDownloadSessionKickoff } from '../lib/offline/waitForDownloadSessionKickoff';
import { isPackActionBusy } from '../features/downloads/packDownloadPresentation';
import { navigateToMapForChartDownload } from '../navigation/rootNavigation';
import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';

export type PackDownloadKickoffResult = 'ready' | 'started' | 'failed';

/** Shared download / cancel handlers for region packs (Downloads screen + passage suggestions). */
export function usePackDownloadActions() {
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const regions = useOfflinePackStore((s) => s.regions);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const startDownload = useOfflinePackStore((s) => s.startDownload);
  const retryDownload = useOfflinePackStore((s) => s.retryDownload);
  const cancelDownload = useOfflinePackStore((s) => s.cancelDownload);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const downloadLocksOtherPacks = activeDownloadRegionId != null || downloadMapTeardownRegionId != null;

  const packBusy = useCallback(
    (packId: string) =>
      isPackActionBusy({
        packId,
        hydrated,
        status: regions[packId] ?? { state: 'idle' },
        activeDownloadRegionId,
        downloadMapTeardownRegionId,
        actionBusyId,
      }),
    [hydrated, activeDownloadRegionId, downloadMapTeardownRegionId, actionBusyId, regions],
  );

  const handleDownload = useCallback(
    async (regionId: string): Promise<PackDownloadKickoffResult> => {
      if (!hydrated) {
        showError(t('common.loading'));
        return 'failed';
      }
      if (activeDownloadRegionId != null || downloadMapTeardownRegionId != null) {
        showError(t('downloads.errorDownloadBusy'));
        return 'failed';
      }
      const status = regions[regionId];
      if (status?.state === 'downloading' || activeDownloadRegionId === regionId) {
        showInfo(t('downloads.downloadAlreadyActive'));
        return 'failed';
      }
      const allowed = await ensureDownloadAllowed();
      if (!allowed.ok) {
        if (allowed.reason === 'offline') showError(t('downloads.errorOffline'));
        else showInfo(t('downloads.cellularCancelledBody'));
        return 'failed';
      }
      setActionBusyId(regionId);
      useOfflinePackStore.getState().resetDownloadErrorForRetry(regionId);
      try {
        await runLockedChartDownloadPreflight(regionId, ensureChartStyle);
        const latest = useOfflinePackStore.getState().regions[regionId];
        // Hand UI back as soon as the exclusive session starts — never block the
        // Downloads screen for the full tile sweep (Maestro cancel + user cancel).
        const downloadPromise =
          latest?.custom || latest?.state === 'error'
            ? retryDownload(regionId)
            : startDownload(regionId);
        const kickoff = await waitForDownloadSessionKickoff(regionId, downloadPromise);
        if (kickoff === 'finished') {
          const next = useOfflinePackStore.getState().regions[regionId];
          reportDownloadOutcome(regionId, { showInfo, showError });
          return next?.state === 'ready' && !next?.error ? 'ready' : 'failed';
        }
        showInfo(t('downloads.downloadStarted'));
        // Map tab owns the visible tile sweep — navigate there so Android can persist tiles.
        navigateToMapForChartDownload();
        void downloadPromise
          .then(() => {
            reportDownloadOutcome(regionId, { showInfo, showError });
          })
          .catch((err) => {
            const current = useOfflinePackStore.getState().regions[regionId];
            if (current?.state !== 'error') {
              reportDownloadFailureFromError(regionId, err, 'async');
            }
          });
        return 'started';
      } catch (err) {
        useOfflinePackStore.getState().releasePreflightDownloadLock(regionId);
        const current = useOfflinePackStore.getState().regions[regionId];
        if (current?.state !== 'error') {
          reportDownloadFailureFromError(regionId, err, 'preflight');
        }
        return 'failed';
      } finally {
        // Always clear local kickoff busy. Exclusive concurrency is owned by
        // activeDownloadRegionId / teardown — leaving actionBusyId set after
        // kickoff greys out every other pack forever (sticky Kiel-bay bug).
        setActionBusyId(null);
      }
    },
    [
      hydrated,
      activeDownloadRegionId,
      downloadMapTeardownRegionId,
      regions,
      ensureChartStyle,
      startDownload,
      retryDownload,
      showInfo,
      showError,
    ],
  );

  const handleCancel = useCallback(
    async (regionId: string) => {
      setActionBusyId(regionId);
      try {
        await cancelDownload(regionId);
        showInfo(t('downloads.downloadCancelled'));
      } finally {
        setActionBusyId(null);
      }
    },
    [cancelDownload, showInfo],
  );

  const handleDownloadAll = useCallback(
    async (regionIds: string[]) => {
      const pending = regionIds.filter((id) => {
        const state = useOfflinePackStore.getState().regions[id]?.state;
        return state !== 'ready' && state !== 'downloading';
      });
      if (pending.length === 0) return { started: 0, ready: 0, failed: 0 };
      let ready = 0;
      let failed = 0;
      for (const regionId of pending) {
        const result = await handleDownload(regionId);
        if (result === 'ready') {
          ready += 1;
          continue;
        }
        if (result === 'started') {
          // One exclusive GL session at a time — stop the queue; remaining packs stay pending.
          break;
        }
        failed += 1;
        if (
          useOfflinePackStore.getState().activeDownloadRegionId != null ||
          useOfflinePackStore.getState().downloadMapTeardownRegionId != null
        ) {
          break;
        }
      }
      return { started: pending.length, ready, failed };
    },
    [handleDownload],
  );

  return {
    hydrated,
    actionBusyId,
    activeDownloadRegionId,
    downloadLocksOtherPacks,
    packBusy,
    handleDownload,
    handleDownloadAll,
    handleCancel,
    setActionBusyId,
  };
}

