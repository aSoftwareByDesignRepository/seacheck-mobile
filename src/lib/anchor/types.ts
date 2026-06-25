export type AnchorWatchStatus = {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  notificationsGranted: boolean;
  backgroundTaskRunning: boolean;
  batteryOptimizationRestricted: boolean;
  limited: boolean;
};
