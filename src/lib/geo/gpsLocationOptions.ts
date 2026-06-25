import * as Location from 'expo-location';

/** Shared high-accuracy options for foreground GPS watch. */
export const FOREGROUND_NAVIGATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 1,
  mayShowUserSettingsDialog: true,
};

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
