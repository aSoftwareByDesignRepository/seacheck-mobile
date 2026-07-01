import { isPackDownloadActive } from '../../features/downloads/packDownloadPresentation';
import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';

type Feedback = {
  showInfo: (message: string) => void;
  showError: (message: string) => void;
};

/** Shared post-start feedback for region and custom downloads. */
export function reportDownloadOutcome(regionId: string, feedback: Feedback) {
  const state = useOfflinePackStore.getState();
  const next = state.regions[regionId];
  const stillActive = isPackDownloadActive(regionId, next ?? { state: 'idle' }, state.activeDownloadRegionId);

  if (next?.state === 'ready' && !next?.error) {
    feedback.showInfo(t('downloads.downloadSuccess'));
    return;
  }
  if (stillActive) {
    feedback.showInfo(t('downloads.downloadStarted'));
  }
  // Async failures toast via useDownloadFailureAlerts — avoids duplicate error banners.
}
