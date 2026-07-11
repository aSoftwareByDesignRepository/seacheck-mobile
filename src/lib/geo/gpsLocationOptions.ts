import * as Location from 'expo-location';

export type ForegroundGpsProfile = 'navigation' | 'idle';

/** High-accuracy watch for map follow, alarms, and passage navigation. */
export const FOREGROUND_NAVIGATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 1,
  mayShowUserSettingsDialog: true,
};

/** Lower-duty watch while the app is open but not actively navigating. */
export const FOREGROUND_IDLE_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 10,
  mayShowUserSettingsDialog: false,
};

export function foregroundGpsOptionsForProfile(profile: ForegroundGpsProfile): Location.LocationOptions {
  return profile === 'navigation' ? FOREGROUND_NAVIGATION_OPTIONS : FOREGROUND_IDLE_OPTIONS;
}

/** iOS navigation activity + no auto-pause — background task only. */
export function backgroundNavigationOptions(
  foregroundService: Location.LocationTaskServiceOptions,
): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    mayShowUserSettingsDialog: true,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    foregroundService,
  };
}
