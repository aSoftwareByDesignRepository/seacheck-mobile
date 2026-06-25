import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { t } from '../../i18n';
import { ensureMaritimeAlarmNotifications } from '../../services/maritimeAlarmNotifications';
import { useLocationStore } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';

export function permissionStatusLabel(status: Location.PermissionStatus | string): string {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
    case 'granted':
      return t('permissions.statusGranted');
    case Location.PermissionStatus.DENIED:
    case 'denied':
      return t('permissions.statusDenied');
    default:
      return t('permissions.statusUndetermined');
  }
}

/** Request foreground location; updates store permission state. */
export async function requestForegroundLocationAccess(): Promise<Location.PermissionStatus> {
  const result = await Location.requestForegroundPermissionsAsync();
  await useLocationStore.getState().refreshPermission();
  return result.status;
}

/**
 * Request background location (requires foreground granted on Android).
 * Enables background track recording when granted.
 */
export async function requestBackgroundLocationAccess(options?: { enableBackgroundTracks?: boolean }): Promise<Location.PermissionStatus> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    const fgResult = await requestForegroundLocationAccess();
    if (fgResult !== Location.PermissionStatus.GRANTED) {
      return fgResult;
    }
  }

  const result = await Location.requestBackgroundPermissionsAsync();
  await useLocationStore.getState().refreshPermission();

  if (result.status === Location.PermissionStatus.GRANTED) {
    if (options?.enableBackgroundTracks === true) {
      await useSettingsStore.getState().patchSettings({ backgroundTrackRecording: true });
    }
    try {
      void ensureMaritimeAlarmNotifications();
      const { initializeAppServices } = await import('./initializeAppServices');
      await initializeAppServices();
    } catch (error) {
      console.warn('[locationPermissions] background sync failed', error);
    }
  }

  return result.status;
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function hasBackgroundLocationAccess(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === Location.PermissionStatus.GRANTED;
}

export async function readLocationPermissionStatuses(): Promise<{
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return { foreground: foreground.status, background: background.status };
}
