import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { refreshAnchorWatchPromptIfNeeded } from '../anchor/activateAnchorAlarm';
import { FOREGROUND_NAVIGATION_OPTIONS } from './gpsLocationOptions';
import { needsForegroundGpsWhileBackgrounded } from './foregroundGpsDemand';
import { syncForegroundLocationWatch } from './syncForegroundLocationWatch';
import { applyBackgroundLocationFix, useLocationStore } from '../../services/locationService';

/**
 * Android foreground-only permission: keep navigation-grade watch alive and seed one fix
 * before the OS may suspend JS when the app moves to background/inactive.
 */
export async function reinforceLimitedForegroundSafetyNet(): Promise<void> {
  const permission = useLocationStore.getState().permission;
  if (permission !== 'foreground' || !needsForegroundGpsWhileBackgrounded()) {
    return;
  }

  await syncForegroundLocationWatch({ requestIfUndetermined: false });
  await refreshAnchorWatchPromptIfNeeded();

  if (AppState.currentState === 'active') {
    return;
  }

  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      return;
    }
    const loc = await Location.getCurrentPositionAsync(FOREGROUND_NAVIGATION_OPTIONS);
    applyBackgroundLocationFix(loc);
  } catch (error) {
    console.warn('[limitedForegroundSafetyNet] seed fix failed', error);
  }
}
