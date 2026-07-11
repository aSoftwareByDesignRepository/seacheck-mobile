import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { t } from '../i18n';
import { publishBackgroundLocationRunning } from '../lib/geo/backgroundLocationHealth';
import { backgroundNavigationOptions } from '../lib/geo/gpsLocationOptions';
import {
  isAnchorMonitoringNeeded,
  isBackgroundTrackNeeded,
  isGoToMonitoringNeeded,
  isMobMonitoringNeeded,
  isPassageMonitoringNeeded,
  shouldRunBackgroundLocation,
} from '../lib/alarms/alarmCoordinator';
import { TRACK_LOCATION_TASK } from './trackLocationTaskConstants';

const BG_MODE_KEY = 'seacheck.location.bgMode';

/** Collapsed native modes — avoid stop/start when only the safety sub-scenario changes. */
export type BgLocationMode = 'safety_mob' | 'safety' | 'track';

export type BgLocationModeFlags = {
  mob: boolean;
  anchor: boolean;
  passage: boolean;
  goTo: boolean;
  track: boolean;
};

export function resolveBgLocationModeFromFlags(flags: BgLocationModeFlags): BgLocationMode | null {
  if (flags.mob) return 'safety_mob';
  if (flags.anchor || flags.passage || flags.goTo) return 'safety';
  if (flags.track) return 'track';
  return null;
}

function safetyMonitoringOptions(): Location.LocationTaskOptions {
  return {
    ...backgroundNavigationOptions({
      notificationTitle: t('location.backgroundSafetyTitle'),
      notificationBody: t('location.backgroundSafetyBody'),
      notificationColor: '#0073ad',
      killServiceOnDestroy: false,
    }),
    timeInterval: 3_000,
    distanceInterval: 2,
  };
}

function mobMonitoringOptions(): Location.LocationTaskOptions {
  return {
    ...backgroundNavigationOptions({
      notificationTitle: t('location.backgroundMobTitle'),
      notificationBody: t('location.backgroundMobBody'),
      notificationColor: '#c62828',
      killServiceOnDestroy: false,
    }),
    timeInterval: 3_000,
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

function optionsForMode(mode: BgLocationMode): Location.LocationTaskOptions {
  switch (mode) {
    case 'safety_mob':
      return mobMonitoringOptions();
    case 'safety':
      return safetyMonitoringOptions();
    case 'track':
      return trackRecordingOptions();
  }
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK);
    publishBackgroundLocationRunning(running);
    return running;
  } catch {
    publishBackgroundLocationRunning(false);
    return false;
  }
}

async function bringUpForegroundSafetyOverlap(): Promise<void> {
  try {
    const { syncForegroundLocationWatch } = await import('../lib/geo/syncForegroundLocationWatch');
    await syncForegroundLocationWatch({ requestIfUndetermined: false });
  } catch (error) {
    console.warn('[backgroundLocationService] foreground overlap failed', error);
  }
}

async function restartBackgroundLocationUpdates(
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

  await bringUpForegroundSafetyOverlap();

  const already = await isBackgroundLocationRunning();
  if (already) {
    await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
    publishBackgroundLocationRunning(false);
  }

  await Location.startLocationUpdatesAsync(TRACK_LOCATION_TASK, options);
  publishBackgroundLocationRunning(true);
  return { ok: true };
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    if (await isBackgroundLocationRunning()) {
      await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
    }
    publishBackgroundLocationRunning(false);
    await AsyncStorage.removeItem(BG_MODE_KEY);
  } catch {
    publishBackgroundLocationRunning(false);
    /* not running */
  }
}

async function reconcileForegroundWatchAfterBackgroundSync(): Promise<void> {
  try {
    const { syncForegroundLocationWatch } = await import('../lib/geo/syncForegroundLocationWatch');
    await syncForegroundLocationWatch({ requestIfUndetermined: false });
  } catch (error) {
    console.warn('[backgroundLocationService] foreground watch reconcile failed', error);
  }
}

async function permissionsAllowBackgroundLocation(): Promise<boolean> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return fg.status === 'granted' && bg.status === 'granted';
}

async function resolveBgLocationModeFlags(): Promise<BgLocationModeFlags> {
  const [mob, anchor, passage, goTo, track] = await Promise.all([
    isMobMonitoringNeeded(),
    isAnchorMonitoringNeeded(),
    isPassageMonitoringNeeded(),
    isGoToMonitoringNeeded(),
    isBackgroundTrackNeeded(),
  ]);
  return { mob, anchor, passage, goTo, track };
}

let bgSyncChain: Promise<{ ok: boolean; reason?: string }> = Promise.resolve({ ok: true });

async function reconcileBackgroundLocationMonitoring(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const shouldRun = await shouldRunBackgroundLocation();
    if (!shouldRun) {
      await stopBackgroundLocationUpdates();
      return { ok: true };
    }

    const flags = await resolveBgLocationModeFlags();
    const mode = resolveBgLocationModeFromFlags(flags);
    if (!mode) {
      await stopBackgroundLocationUpdates();
      return { ok: true };
    }

    const lastMode = await AsyncStorage.getItem(BG_MODE_KEY);
    const running = await isBackgroundLocationRunning();
    if (running && lastMode === mode) {
      if (!(await permissionsAllowBackgroundLocation())) {
        await stopBackgroundLocationUpdates();
        return { ok: false, reason: 'permission_revoked' };
      }
      return { ok: true };
    }

    const result = await restartBackgroundLocationUpdates(optionsForMode(mode));
    if (result.ok) {
      await AsyncStorage.setItem(BG_MODE_KEY, mode);
      return { ok: true };
    }

    const safetyCritical = flags.mob || flags.anchor || flags.passage || flags.goTo;
    if (safetyCritical) {
      return { ok: false, reason: result.reason };
    }

    return { ok: false, reason: result.reason };
  } finally {
    await reconcileForegroundWatchAfterBackgroundSync();
    void isBackgroundLocationRunning();
  }
}

/**
 * Start or stop unified background GPS updates for safety monitoring and/or track recording.
 * Safety scenarios share collapsed modes so anchor/passage/go-to switches do not restart the task.
 */
export function syncBackgroundLocationMonitoring(): Promise<{ ok: boolean; reason?: string }> {
  const next = bgSyncChain.then(() => reconcileBackgroundLocationMonitoring());
  bgSyncChain = next.then(
    (result) => result,
    (error) => {
      console.warn('[backgroundLocationService] sync failed', error);
      return { ok: false, reason: 'sync_failed' };
    },
  );
  return next;
}

/** Test-only — reset serialized sync chain between cases. */
export function resetBackgroundLocationSyncChainForTests(): void {
  bgSyncChain = Promise.resolve({ ok: true });
}

/** Persist the active recording id, then reconcile the unified background GPS task. */
export async function syncRecordingBackgroundGps(trackId: string | null): Promise<void> {
  const { persistRecordingTrackId } = await import('./trackBackgroundTask');
  await persistRecordingTrackId(trackId);
  await syncBackgroundLocationMonitoring();
}
