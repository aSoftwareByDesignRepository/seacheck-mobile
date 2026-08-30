import { getBatteryOptimizationStatus } from '../permissions/batteryOptimization';
import { isValidCoordinate } from '../geo/fixQuality';
import type { AnchorWatchStatus } from './types';
import { t } from '../../i18n';
import { requestConfirm } from '../../store/confirmStore';
import {
  getMaritimeNotificationPermission,
  refreshMaritimeNotificationPermission,
} from '../../services/maritimeAlarmNotifications';
import { isBackgroundLocationRunning } from '../../services/backgroundLocationService';
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
  const backgroundTaskRunning = await isBackgroundLocationRunning();
  const batteryStatus = await getBatteryOptimizationStatus();
  const batteryOptimizationRestricted = batteryStatus !== 'exempt';
  const reducedAccuracy = useLocationStore.getState().reducedAccuracy;
  const limited =
    !foregroundGranted ||
    !backgroundGranted ||
    !notificationsGranted ||
    !backgroundTaskRunning ||
    batteryOptimizationRestricted ||
    reducedAccuracy;
  return {
    foregroundGranted,
    backgroundGranted,
    notificationsGranted,
    backgroundTaskRunning,
    batteryOptimizationRestricted,
    reducedAccuracy,
    limited,
  };
}

/** Re-check anchor-watch readiness after permission or battery changes. */
export async function refreshAnchorWatchPromptIfNeeded(): Promise<AnchorWatchStatus | null> {
  const nav = useNavigationStore.getState();
  if (!nav.anchorAlarm?.active) return null;

  const status = await getAnchorWatchStatus();
  await useNavigationStore.getState().patchAnchorArmedLimited(status.limited);

  if (status.limited) {
    if (nav.anchorWatchPrompt || !nav.anchorWatchPromptDismissed) {
      useNavigationStore.getState().setAnchorWatchPrompt(status);
    }
  } else {
    useNavigationStore.setState({
      anchorWatchPrompt: null,
      anchorWatchPromptDismissed: false,
    });
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

  const statusBefore = await getAnchorWatchStatus();
  if (statusBefore.limited) {
    const confirmed = await requestConfirm({
      title: t('map.anchorWatchLimitedTitle'),
      message: t('map.anchorWatchLimitedBody'),
      confirmLabel: t('map.anchorActivateLimitedConfirm'),
      cancelLabel: t('common.dismiss'),
      destructive: false,
    });
    if (!confirmed) return null;
  }

  await nav.setAnchorAlarm(lat, lon, effectiveRadius, { armedLimited: statusBefore.limited });
  const status = await getAnchorWatchStatus();
  await useNavigationStore.getState().patchAnchorArmedLimited(status.limited);

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
