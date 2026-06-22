import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { msToKnots, LOW_SOG_KN } from '../lib/geo/navigation';
import { appendTrackPointDirect } from './trackRecordingService';

export const TRACK_LOCATION_TASK = 'seacheck-track-recording';

const RECORDING_TRACK_KEY = 'seacheck.track.recordingId';
const LAST_POINT_MS_KEY = 'seacheck.track.lastPointMs';

/** ~1 kn — below this, use anchored interval. */
const ANCHORED_SPEED_MS = 0.514;
const MOVING_INTERVAL_MS = 10_000;
const ANCHORED_INTERVAL_MS = 60_000;

function cogFromLocation(loc: Location.LocationObject): number | null {
  const kn = msToKnots(loc.coords.speed) ?? 0;
  if (kn < LOW_SOG_KN) return null;
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

TaskManager.defineTask(TRACK_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  if (!payload?.locations?.length) return;

  const trackId = await AsyncStorage.getItem(RECORDING_TRACK_KEY);
  if (!trackId) return;

  for (const loc of payload.locations) {
    const now = loc.timestamp ?? Date.now();
    if (!(await shouldPersistPoint(loc.coords.speed, now))) continue;

    await appendTrackPointDirect(trackId, {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      sog_ms: loc.coords.speed,
      cog_deg: cogFromLocation(loc),
      recorded_at: now,
    });
    await AsyncStorage.setItem(LAST_POINT_MS_KEY, String(now));
  }
});

export async function persistRecordingTrackId(trackId: string | null) {
  if (trackId) {
    await AsyncStorage.setItem(RECORDING_TRACK_KEY, trackId);
    await AsyncStorage.removeItem(LAST_POINT_MS_KEY);
  } else {
    await AsyncStorage.removeItem(RECORDING_TRACK_KEY);
    await AsyncStorage.removeItem(LAST_POINT_MS_KEY);
  }
}
