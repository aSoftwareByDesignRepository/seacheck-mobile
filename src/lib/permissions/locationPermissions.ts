import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { t } from '../../i18n';
import { ensureMaritimeAlarmNotifications } from '../../services/maritimeAlarmNotifications';
import { useLocationStore } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';
import {
  isLocationPermissionBlocked,
  readLocationPermissionSnapshot,
  type LocationAccessResult,
  type LocationPermissionSnapshot,
} from './locationPermissionState';

export type { LocationAccessResult, LocationPermissionSnapshot } from './locationPermissionState';
export {
  isLocationPermissionBlocked,
  isReducedLocationAccuracy,
  mapSnapshotToPermissionState,
  readLocationPermissionSnapshot,
} from './locationPermissionState';

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

async function syncLocationPermissionStore(): Promise<LocationPermissionSnapshot> {
  const snapshot = await readLocationPermissionSnapshot();
  await useLocationStore.getState().applyPermissionSnapshot(snapshot);
  return snapshot;
}

async function onBackgroundLocationGranted(options?: { enableBackgroundTracks?: boolean }): Promise<void> {
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

/** Request foreground location; updates store permission state. */
export async function requestForegroundLocationAccess(): Promise<LocationAccessResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === Location.PermissionStatus.GRANTED) {
    await syncLocationPermissionStore();
    return { status: current.status, blocked: false };
  }
  if (isLocationPermissionBlocked(current)) {
    await syncLocationPermissionStore();
    return { status: current.status, blocked: true };
  }

  const result = await Location.requestForegroundPermissionsAsync();
  await syncLocationPermissionStore();
  return { status: result.status, blocked: isLocationPermissionBlocked(result) };
}

/**
 * Request background location (requires foreground granted on Android).
 * Enables background track recording when granted and `enableBackgroundTracks` is true.
 */
export async function requestBackgroundLocationAccess(options?: {
  enableBackgroundTracks?: boolean;
}): Promise<LocationAccessResult> {
  const fgResult = await requestForegroundLocationAccess();
  if (fgResult.status !== Location.PermissionStatus.GRANTED) {
    return fgResult;
  }

  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === Location.PermissionStatus.GRANTED) {
    await onBackgroundLocationGranted(options);
    await syncLocationPermissionStore();
    return { status: current.status, blocked: false };
  }
  if (isLocationPermissionBlocked(current)) {
    await syncLocationPermissionStore();
    return { status: current.status, blocked: true };
  }

  const result = await Location.requestBackgroundPermissionsAsync();
  await syncLocationPermissionStore();
  if (result.status === Location.PermissionStatus.GRANTED) {
    await onBackgroundLocationGranted(options);
  }
  return { status: result.status, blocked: isLocationPermissionBlocked(result) };
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}
