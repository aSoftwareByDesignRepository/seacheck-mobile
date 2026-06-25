import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { t } from '../i18n';
import { backgroundNavigationOptions } from '../lib/geo/gpsLocationOptions';
import {
  isAnchorMonitoringNeeded,
  isBackgroundTrackNeeded,
  shouldRunBackgroundLocation,
} from '../lib/alarms/alarmCoordinator';
import { TRACK_LOCATION_TASK } from './trackLocationTaskConstants';

const BG_MODE_KEY = 'seacheck.location.bgMode';

function anchorMonitoringOptions(): Location.LocationTaskOptions {
  return {
    ...backgroundNavigationOptions({
      notificationTitle: t('location.backgroundAnchorTitle'),
      notificationBody: t('location.backgroundAnchorBody'),
      notificationColor: '#0073ad',
      killServiceOnDestroy: false,
    }),
    timeInterval: 5_000,
    distanceInterval: 2,
  };
}

function trackRecordingOptions(): Location.LocationTaskOptions {
  return {
    ...backgroundNavigationOptions({
      notificationTitle: t('tracks.backgroundNotificationTitle'),
      notificationBody: t('tracks.backgroundNotificationBody'),
      notificationColor: '#0073ad',
      killServiceOnDestroy: false,
    }),
    timeInterval: 10_000,
    distanceInterval: 3,
  };
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK);
  } catch {
    return false;
  }
}

async function startBackgroundLocationUpdates(
  options: Location.LocationTaskOptions,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { ok: false, reason: 'background_denied' };
  }

  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { ok: false, reason: 'foreground_denied' };
  }

  const already = await isBackgroundLocationRunning();
  if (already) {
    await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(TRACK_LOCATION_TASK, options);
  return { ok: true };
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    if (await isBackgroundLocationRunning()) {
      await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
    }
    await AsyncStorage.removeItem(BG_MODE_KEY);
  } catch {
    /* not running */
  }
}

/**
 * Start or stop unified background GPS updates for anchor monitoring and/or track recording.
 * Anchor monitoring uses a faster interval and a dedicated foreground-service notification.
 */
export async function syncBackgroundLocationMonitoring(): Promise<{ ok: boolean; reason?: string }> {
  const shouldRun = await shouldRunBackgroundLocation();
  if (!shouldRun) {
    await stopBackgroundLocationUpdates();
    return { ok: true };
  }

  const anchor = await isAnchorMonitoringNeeded();
  const track = await isBackgroundTrackNeeded();
  const mode = anchor ? 'anchor' : 'track';
  const options = anchor ? anchorMonitoringOptions() : trackRecordingOptions();

  const lastMode = await AsyncStorage.getItem(BG_MODE_KEY);
  const running = await isBackgroundLocationRunning();
  if (running && lastMode === mode) {
    return { ok: true };
  }

  const result = await startBackgroundLocationUpdates(options);
  if (result.ok) {
    await AsyncStorage.setItem(BG_MODE_KEY, mode);
    return { ok: true };
  }

  if (!track && anchor) {
    return { ok: false, reason: result.reason };
  }

  return { ok: false, reason: result.reason };
}

/** Persist the active recording id, then reconcile the unified background GPS task. */
export async function syncRecordingBackgroundGps(trackId: string | null): Promise<void> {
  const { persistRecordingTrackId } = await import('./trackBackgroundTask');
  await persistRecordingTrackId(trackId);
  await syncBackgroundLocationMonitoring();
}
