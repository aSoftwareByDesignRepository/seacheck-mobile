import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { bearingTrue, distanceNm, msToKnots, LOW_SOG_KN, type LonLat } from '../lib/geo/navigation';
import { TRACK_LOCATION_TASK } from './trackLocationTaskConstants';

const RECORDING_TRACK_KEY = 'seacheck.track.recordingId';
const LAST_POINT_MS_KEY = 'seacheck.track.lastPointMs';

/** ~1 kn — below this, use anchored interval. */
const ANCHORED_SPEED_MS = 0.514;
const MOVING_INTERVAL_MS = 10_000;
const ANCHORED_INTERVAL_MS = 60_000;

const LAST_POS_KEY = 'seacheck.track.lastPos';

function cogFromLocation(loc: Location.LocationObject, prev: LonLat | null): number | null {
  const kn = msToKnots(loc.coords.speed) ?? 0;
  const pos: LonLat = [loc.coords.longitude, loc.coords.latitude];
  if (prev && kn >= LOW_SOG_KN) {
    const dist = distanceNm(prev, pos);
    if (dist >= 0.001) return bearingTrue(prev, pos);
  }
  if (kn < LOW_SOG_KN) {
    if (loc.coords.heading != null && !Number.isNaN(loc.coords.heading)) {
      return ((loc.coords.heading % 360) + 360) % 360;
    }
    return null;
  }
  if (loc.coords.heading != null && !Number.isNaN(loc.coords.heading)) {
    return ((loc.coords.heading % 360) + 360) % 360;
  }
  return null;
}

async function shouldPersistPoint(speedMs: number | null, now: number): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LAST_POINT_MS_KEY);
  const last = raw ? Number.parseInt(raw, 10) : 0;
  const interval = (speedMs ?? 0) < ANCHORED_SPEED_MS ? ANCHORED_INTERVAL_MS : MOVING_INTERVAL_MS;
  return now - last >= interval;
}

async function persistTrackPoint(loc: Location.LocationObject): Promise<void> {
  const trackId = await AsyncStorage.getItem(RECORDING_TRACK_KEY);
  if (!trackId) return;

  const now = loc.timestamp ?? Date.now();
  if (!(await shouldPersistPoint(loc.coords.speed, now))) return;

  const pos: LonLat = [loc.coords.longitude, loc.coords.latitude];
  const prevRaw = await AsyncStorage.getItem(LAST_POS_KEY);
  let prev: LonLat | null = null;
  if (prevRaw) {
    try {
      prev = JSON.parse(prevRaw) as LonLat;
    } catch {
      prev = null;
    }
  }

  const { appendTrackPointDirect } = await import('./trackPointWriter');
  await appendTrackPointDirect(trackId, {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    sog_ms: loc.coords.speed,
    cog_deg: cogFromLocation(loc, prev),
    recorded_at: now,
  });
  await AsyncStorage.setItem(LAST_POINT_MS_KEY, String(now));
  await AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(pos));
}

TaskManager.defineTask(TRACK_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      console.warn('[trackBackgroundTask] location task error', error);
      return;
    }
    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    if (!payload?.locations?.length) return;

    const appInForeground = AppState.currentState === 'active';
    const [{ applyBackgroundLocationFix }, { processFixFromLocation }] = await Promise.all([
      import('./locationService'),
      import('../lib/alarms/alarmCoordinator'),
    ]);

    for (const loc of payload.locations) {
      const inBackground = !appInForeground;
      if (appInForeground) {
        applyBackgroundLocationFix(loc);
        // Foreground alarms are handled by useAlarmMonitor — skip here to avoid double evaluation.
      } else {
        await processFixFromLocation(loc, { allowLegAdvancePrompt: false, inBackground: true });
      }
      await persistTrackPoint(loc);
    }
  } catch (taskError) {
    console.warn('[trackBackgroundTask] failed', taskError);
  }
});

export { TRACK_LOCATION_TASK } from './trackLocationTaskConstants';

export async function persistRecordingTrackId(trackId: string | null) {
  if (trackId) {
    await AsyncStorage.setItem(RECORDING_TRACK_KEY, trackId);
    await AsyncStorage.removeItem(LAST_POINT_MS_KEY);
    await AsyncStorage.removeItem(LAST_POS_KEY);
  } else {
    await AsyncStorage.removeItem(RECORDING_TRACK_KEY);
    await AsyncStorage.removeItem(LAST_POINT_MS_KEY);
    await AsyncStorage.removeItem(LAST_POS_KEY);
  }
}
