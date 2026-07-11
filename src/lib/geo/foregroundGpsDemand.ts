import { isMapScreenFocused } from '../map/mapScreenFocus';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrackStore } from '../../store/trackStore';
import type { ForegroundGpsProfile } from './gpsLocationOptions';

export type ForegroundGpsDemandInput = {
  mapScreenFocused: boolean;
  mobTarget: boolean;
  goToTargetActive: boolean;
  recordingTrackId: string | null;
  backgroundTrackRecording: boolean;
  locationPermission: ReturnType<typeof useLocationStore.getState>['permission'];
};

/** Pure resolver — used by tests and the adaptive location watch hook. */
export function resolveForegroundGpsProfile(input: ForegroundGpsDemandInput): ForegroundGpsProfile {
  if (input.mobTarget) return 'navigation';
  if (input.goToTargetActive) return 'navigation';

  const foregroundTrackRecording =
    input.recordingTrackId != null &&
    !(input.backgroundTrackRecording && input.locationPermission === 'background');
  if (foregroundTrackRecording) return 'navigation';

  if (input.mapScreenFocused) return 'navigation';
  return 'idle';
}

export function readForegroundGpsDemand(): ForegroundGpsDemandInput {
  const nav = useNavigationStore.getState();
  const settings = useSettingsStore.getState();
  const track = useTrackStore.getState();
  const location = useLocationStore.getState();

  return {
    mapScreenFocused: isMapScreenFocused(),
    mobTarget: nav.mobTarget != null || nav.goToTarget?.kind === 'mob',
    goToTargetActive: nav.goToTarget != null,
    recordingTrackId: track.recordingTrackId,
    backgroundTrackRecording: settings.backgroundTrackRecording,
    locationPermission: location.permission,
  };
}

export function currentForegroundGpsProfile(): ForegroundGpsProfile {
  return resolveForegroundGpsProfile(readForegroundGpsDemand());
}

/** Scenarios that must keep a foreground watch when the app is not active and no bg pipeline applies. */
export function needsForegroundGpsWhileBackgrounded(): boolean {
  const demand = readForegroundGpsDemand();
  const foregroundTrackRecording =
    demand.recordingTrackId != null &&
    !(demand.backgroundTrackRecording && demand.locationPermission === 'background');
  if (foregroundTrackRecording) return true;
  if (demand.locationPermission === 'background') return false;
  if (demand.mobTarget) return true;
  const nav = useNavigationStore.getState();
  // Limited anchor watch (foreground-only): keep best-effort fixes on Android.
  if (nav.anchorAlarm?.active) return true;
  // Standalone or passage go-to with foreground-only permission — best-effort arrival alarms.
  if (demand.goToTargetActive) return true;
  return false;
}
