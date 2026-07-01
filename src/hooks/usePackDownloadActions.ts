import { useCallback, useState } from 'react';

import { ensureDownloadAllowed } from '../lib/network/downloadPolicy';
import { runLockedChartDownloadPreflight } from '../lib/offline/downloadPreflight';
import { reportDownloadFailureFromError } from '../lib/offline/reportDownloadFailure';
import { reportDownloadOutcome } from '../lib/offline/reportDownloadOutcome';
import { isPackDownloadActive } from '../features/downloads/packDownloadPresentation';
import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';

/** Shared download / cancel handlers for region packs (Downloads screen + passage suggestions). */
export function usePackDownloadActions() {
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const regions = useOfflinePackStore((s) => s.regions);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const startDownload = useOfflinePackStore((s) => s.startDownload);
  const retryDownload = useOfflinePackStore((s) => s.retryDownload);
  const cancelDownload = useOfflinePackStore((s) => s.cancelDownload);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const downloadLocksOtherPacks = activeDownloadRegionId != null;

  const packBusy = useCallback(
    (packId: string) => {
      if (!hydrated) return true;
      if (isPackDownloadActive(packId, regions[packId] ?? { state: 'idle' }, activeDownloadRegionId)) return false;
      return downloadLocksOtherPacks || (actionBusyId != null && actionBusyId !== packId);
    },
    [hydrated, activeDownloadRegionId, downloadLocksOtherPacks, actionBusyId, regions],
  );

  const handleDownload = useCallback(
    async (regionId: string) => {
      if (!hydrated) {
        showError(t('common.loading'));
        return false;
      }
      if (activeDownloadRegionId != null) {
        showError(t('downloads.errorDownloadBusy'));
        return false;
      }
      const status = regions[regionId];
      if (status?.state === 'downloading' || activeDownloadRegionId === regionId) {
        showInfo(t('downloads.downloadAlreadyActive'));
        return false;
      }
      const allowed = await ensureDownloadAllowed();
      if (!allowed) {
        showInfo(t('downloads.cellularCancelledBody'));
        return false;
      }
      setActionBusyId(regionId);
      try {
        await runLockedChartDownloadPreflight(regionId, ensureChartStyle);
        const latest = useOfflinePackStore.getState().regions[regionId];
        if (latest?.custom || latest?.state === 'error') {
          await retryDownload(regionId);
        } else {
          await startDownload(regionId);
        }
        const next = useOfflinePackStore.getState().regions[regionId];
        reportDownloadOutcome(regionId, { showInfo, showError });
        return next?.state === 'ready' && !next?.error;
      } catch (err) {
        useOfflinePackStore.getState().releasePreflightDownloadLock(regionId);
        reportDownloadFailureFromError(regionId, err, 'preflight');
        return false;
      } finally {
        const next = useOfflinePackStore.getState().regions[regionId];
        const stillActive = isPackDownloadActive(
          regionId,
          next ?? { state: 'idle' },
          useOfflinePackStore.getState().activeDownloadRegionId,
        );
        if (!stillActive) setActionBusyId(null);
      }
    },
    [
      hydrated,
      activeDownloadRegionId,
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
        const ok = await handleDownload(regionId);
        const state = useOfflinePackStore.getState().regions[regionId]?.state;
        if (ok || state === 'ready' || state === 'downloading') ready += 1;
        else if (state === 'error') failed += 1;
        else break;
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
