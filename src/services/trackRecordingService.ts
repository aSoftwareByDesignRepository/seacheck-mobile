import * as Location from 'expo-location';

import { getDatabase } from '../lib/db/database';
import { t } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { TRACK_LOCATION_TASK, persistRecordingTrackId } from './trackBackgroundTask';

export type TrackPointInput = {
  latitude: number;
  longitude: number;
  sog_ms: number | null;
  cog_deg: number | null;
  recorded_at?: number;
};

export async function appendTrackPointDirect(trackId: string, input: TrackPointInput) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO track_points (track_id, latitude, longitude, sog_ms, cog_deg, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    trackId,
    input.latitude,
    input.longitude,
    input.sog_ms,
    input.cog_deg,
    input.recorded_at ?? Date.now(),
  );
}

export async function isBackgroundTrackTaskRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startBackgroundTrackUpdates(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { ok: false, reason: 'background_denied' };
  }

  const already = await isBackgroundTrackTaskRunning();
  if (already) return { ok: true };

  await Location.startLocationUpdatesAsync(TRACK_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 10_000,
    distanceInterval: 3,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: t('tracks.backgroundNotificationTitle'),
      notificationBody: t('tracks.backgroundNotificationBody'),
      notificationColor: '#0073ad',
      killServiceOnDestroy: false,
    },
  });

  return { ok: true };
}

export async function stopBackgroundTrackUpdates() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRACK_LOCATION_TASK);
    }
  } catch {
    /* not running */
  }
}

/** Start background GPS updates when settings allow and permission granted. */
export async function syncBackgroundTrackRecording(trackId: string | null): Promise<void> {
  await persistRecordingTrackId(trackId);

  if (!trackId) {
    await stopBackgroundTrackUpdates();
    return;
  }

  const backgroundEnabled = useSettingsStore.getState().backgroundTrackRecording;
  if (!backgroundEnabled) {
    await stopBackgroundTrackUpdates();
    return;
  }

  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;

  const result = await startBackgroundTrackUpdates();
  if (!result.ok && result.reason === 'background_denied') {
    /* foreground interval fallback remains active in TracksScreen */
  }
}
