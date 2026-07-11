import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  getBatteryOptimizationStatus,
  type BatteryOptimizationStatus,
} from '../lib/permissions/batteryOptimization';

/** Reads Android battery optimization status on mount and when the app returns to foreground. */
export function useBatteryOptimization(enabled = Platform.OS === 'android'): BatteryOptimizationStatus {
  const [status, setStatus] = useState<BatteryOptimizationStatus>(Platform.OS === 'android' ? 'unknown' : 'exempt');

  const refresh = useCallback(async () => {
    if (!enabled || Platform.OS !== 'android') {
      setStatus('exempt');
      return;
    }
    setStatus(await getBatteryOptimizationStatus());
  }, [enabled]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return status;
}
