import { getBatteryOptimizationStatus } from '../permissions/batteryOptimization';
import { isValidCoordinate } from '../geo/fixQuality';
import type { AnchorWatchStatus } from './types';
import { t } from '../../i18n';
import {
  ensureMaritimeAlarmNotifications,
  getMaritimeNotificationPermission,
  refreshMaritimeNotificationPermission,
} from '../../services/maritimeAlarmNotifications';
import { DEFAULT_ANCHOR_RADIUS_NM, normalizeAnchorRadiusNm } from '../settings/mapSettings';
import { distanceUnitLabel, formatDistanceNm } from '../geo/units';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';

export type { AnchorWatchStatus } from './types';

export { DEFAULT_ANCHOR_RADIUS_NM };

export async function getAnchorWatchStatus(): Promise<AnchorWatchStatus> {
  await useLocationStore.getState().refreshPermission();
  await refreshMaritimeNotificationPermission();
  const permission = useLocationStore.getState().permission;
  const foregroundGranted = permission === 'foreground' || permission === 'background';
  const backgroundGranted = permission === 'background';
  const notificationsGranted = getMaritimeNotificationPermission() === 'granted';
  const { isBackgroundLocationRunning } = await import('../../services/backgroundLocationService');
  const backgroundTaskRunning = await isBackgroundLocationRunning();
  const batteryStatus = await getBatteryOptimizationStatus();
  const batteryOptimizationRestricted = batteryStatus !== 'exempt';
  const limited =
    !foregroundGranted ||
    !backgroundGranted ||
    !notificationsGranted ||
    !backgroundTaskRunning ||
    batteryOptimizationRestricted;
  return {
    foregroundGranted,
    backgroundGranted,
    notificationsGranted,
    backgroundTaskRunning,
    batteryOptimizationRestricted,
    limited,
  };
}

/** Re-check anchor-watch readiness after permission or battery changes; updates the limited sheet only when already open. */
export async function refreshAnchorWatchPromptIfNeeded(): Promise<AnchorWatchStatus | null> {
  const nav = useNavigationStore.getState();
  if (!nav.anchorAlarm?.active) return null;

  const status = await getAnchorWatchStatus();
  if (nav.anchorWatchPrompt) {
    useNavigationStore.getState().setAnchorWatchPrompt(status.limited ? status : null);
  }
  return status;
}

/**
 * Sets anchor alarm at coordinates and guides user when background watch is incomplete.
 * Used by FAB and long-press map paths so behaviour is identical.
 * When an anchor is already active, pass `replace: true` after user confirmation.
 */
export async function activateAnchorAlarmAt(
  lat: number,
  lon: number,
  radiusNm?: number,
  options?: { replace?: boolean },
): Promise<AnchorWatchStatus | null> {
  const feedback = useFeedbackStore.getState();
  const nav = useNavigationStore.getState();
  const effectiveRadius =
    radiusNm != null
      ? Math.max(0.01, radiusNm)
      : normalizeAnchorRadiusNm(useSettingsStore.getState().anchorRadiusNm);

  if (!isValidCoordinate(lat, lon)) {
    feedback.showError(t('map.anchorNoGpsBody'));
    return null;
  }

  if (nav.anchorAlarm?.active && !options?.replace) {
    feedback.showInfo(t('map.anchorAlreadyActive'));
    return null;
  }

  await nav.setAnchorAlarm(lat, lon, effectiveRadius);
  const status = await getAnchorWatchStatus();
  const distanceUnit = useSettingsStore.getState().distanceUnit;
  const radiusLabel = formatDistanceNm(effectiveRadius, distanceUnit, 2);
  const unitLabel = distanceUnitLabel(distanceUnit);

  feedback.showSuccess(
    status.limited
      ? t('map.anchorSetLimitedBody', { value: radiusLabel, unit: unitLabel })
      : t('map.anchorSetBody', { value: radiusLabel, unit: unitLabel }),
  );

  if (status.limited) {
    useNavigationStore.getState().setAnchorWatchPrompt(status);
  }

  return status;
}
