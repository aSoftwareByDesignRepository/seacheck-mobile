import { useEffect, useState } from 'react';

import {
  getBarometerState,
  startBarometerSampling,
  stopBarometerSampling,
  subscribeBarometer,
  type BarometerStateSnapshot,
} from '../services/barometerService';

const INACTIVE: BarometerStateSnapshot = {
  available: false,
  readings: [],
  trend: { currentHpa: null, delta3h: null, trend: 'unknown' },
  hydrated: true,
};

/** Pressure trend — only samples when `enabled` (Settings → Barometer). */
export function useBarometer(enabled: boolean) {
  const [state, setState] = useState(() => (enabled ? getBarometerState() : INACTIVE));

  useEffect(() => {
    if (!enabled) {
      stopBarometerSampling();
      setState(INACTIVE);
      return;
    }

    void startBarometerSampling();
    const unsub = subscribeBarometer(setState);
    return () => {
      unsub();
      stopBarometerSampling();
    };
  }, [enabled]);

  return enabled ? state : INACTIVE;
}
