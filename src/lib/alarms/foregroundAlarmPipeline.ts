import { AppState } from 'react-native';

import { needsForegroundGpsWhileBackgrounded } from '../geo/foregroundGpsDemand';
import { needsUnifiedBackgroundGps } from '../geo/syncForegroundLocationWatch';

/**
 * Whether the foreground fix pipeline (useAlarmMonitor) should evaluate maritime alarms
 * for the current fix. Returns false when the unified background task owns alarm evaluation.
 */
export async function shouldForegroundPipelineEvaluateAlarms(
  isBackgroundLocationRunning: () => Promise<boolean> = async () => {
    const { isBackgroundLocationRunning: check } = await import('../../services/backgroundLocationService');
    return check();
  },
): Promise<boolean> {
  if (AppState.currentState === 'active') {
    return true;
  }

  // Unified background GPS owns alarm evaluation once the native task is running.
  if (needsUnifiedBackgroundGps()) {
    try {
      if (await isBackgroundLocationRunning()) {
        return false;
      }
    } catch {
      // Fail open — treat as transitional window; never skip safety alarms when native status is unknown.
      return true;
    }
  }

  // Foreground-only permission: best-effort alarms via the foreground watch.
  return needsForegroundGpsWhileBackgrounded();
}
