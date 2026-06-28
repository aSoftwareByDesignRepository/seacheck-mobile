import { useAlarmMonitor } from '../services/alarmMonitor';

/** Maritime alarms run app-wide — not only when the Map tab is mounted. */
export function useMaritimeMonitors() {
  useAlarmMonitor();
}
