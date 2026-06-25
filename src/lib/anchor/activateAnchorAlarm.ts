import { getBatteryOptimizationStatus } from '../permissions/batteryOptimization';
import { isValidCoordinate } from '../geo/fixQuality';
import type { AnchorWatchStatus } from './types';
import { t } from '../../i18n';
import {
  ensureMaritimeAlarmNotifications,
  getMaritimeNotificationPermission,
  refreshMaritimeNotificationPermission,
} from '../../services/maritimeAlarmNotifications';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';

export type { AnchorWatchStatus } from './types';

export const DEFAULT_ANCHOR_RADIUS_NM = 0.05;

export async function getAnchorWatchStatus(): Promise<AnchorWatchStatus> {
  await useLocationStore.getState().refreshPermission();
  await refreshMaritimeNotificationPermission();
  const permission = useLocationStore.getState().permission;
  const backgroundGranted = permission === 'background';
  const notificationsGranted = getMaritimeNotificationPermission() === 'granted';
  const { isBackgroundLocationRunning } = await import('../../services/backgroundLocationService');
  const backgroundTaskRunning = await isBackgroundLocationRunning();
  const batteryStatus = await getBatteryOptimizationStatus();
  const batteryOptimizationRestricted = batteryStatus !== 'exempt';
  const limited =
    !backgroundGranted ||
    !notificationsGranted ||
    !backgroundTaskRunning ||
    batteryOptimizationRestricted;
  return {
    backgroundGranted,
    notificationsGranted,
    backgroundTaskRunning,
    batteryOptimizationRestricted,
    limited,
  };
}

/** Re-check anchor-watch readiness after permission or battery changes; updates the limited sheet if open. */
export async function refreshAnchorWatchPromptIfNeeded(): Promise<AnchorWatchStatus | null> {
  const nav = useNavigationStore.getState();
  if (!nav.anchorAlarm?.active) return null;

  const status = await getAnchorWatchStatus();
  if (nav.anchorWatchPrompt || status.limited) {
    useNavigationStore.getState().setAnchorWatchPrompt(status.limited ? status : null);
  }
  return status;
}

/**
 * Sets anchor alarm at coordinates and guides user when background watch is incomplete.
 * Used by FAB and long-press map paths so behaviour is identical.
 */
export async function activateAnchorAlarmAt(lat: number, lon: number, radiusNm = DEFAULT_ANCHOR_RADIUS_NM): Promise<AnchorWatchStatus | null> {
  const feedback = useFeedbackStore.getState();

  if (!isValidCoordinate(lat, lon)) {
    feedback.showError(t('map.anchorNoGpsBody'));
    return null;
  }

  await useNavigationStore.getState().setAnchorAlarm(lat, lon, radiusNm);
  const status = await getAnchorWatchStatus();

  feedback.showSuccess(
    status.limited
      ? t('map.anchorSetLimitedBody', { nm: radiusNm.toFixed(2) })
      : t('map.anchorSetBody', { nm: radiusNm.toFixed(2) }),
  );

  if (status.limited) {
    useNavigationStore.getState().setAnchorWatchPrompt(status);
  }

  return status;
}
