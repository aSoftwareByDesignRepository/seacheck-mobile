import * as Location from 'expo-location';

import { appendTrackPointDirect, type TrackPointInput } from './trackPointWriter';
import { TRACK_LOCATION_TASK } from './trackLocationTaskConstants';

export type { TrackPointInput };

export { appendTrackPointDirect };

export async function isBackgroundTrackTaskRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACK_LOCATION_TASK);
  } catch {
    return false;
  }
}

export { syncBackgroundTrackRecording, syncBackgroundLocationMonitoring, isBackgroundLocationRunning } from './backgroundLocationService';

/** @deprecated Use syncBackgroundLocationMonitoring via backgroundLocationService */
export async function startBackgroundTrackUpdates(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { ok: false, reason: 'background_denied' };
  }

  const { syncBackgroundLocationMonitoring } = await import('./backgroundLocationService');
  const result = await syncBackgroundLocationMonitoring();
  return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? 'unknown' };
}

export async function stopBackgroundTrackUpdates() {
  const { stopBackgroundLocationUpdates } = await import('./backgroundLocationService');
  await stopBackgroundLocationUpdates();
}
