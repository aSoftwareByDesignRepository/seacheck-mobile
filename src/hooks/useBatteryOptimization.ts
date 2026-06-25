import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  getBatteryOptimizationStatus,
  type BatteryOptimizationStatus,
} from '../lib/permissions/batteryOptimization';

/** Polls Android battery optimization status; iOS always exempt. */
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
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  return status;
}
