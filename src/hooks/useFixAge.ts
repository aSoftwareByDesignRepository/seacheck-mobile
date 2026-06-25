import { useEffect, useState } from 'react';

import { FIX_AGING_MS, FIX_STALE_MS, fixAgeSeconds, isFixOlderThan } from '../lib/geo/fixAge';
import { useLocationStore } from '../services/locationService';

export function useFixAge(): {
  ageSec: number | null;
  isAging: boolean;
  isStale: boolean;
  permissionDenied: boolean;
} {
  const fix = useLocationStore((s) => s.fix);
  const permission = useLocationStore((s) => s.permission);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return {
    ageSec: fixAgeSeconds(fix, now),
    isAging: isFixOlderThan(fix, FIX_AGING_MS) && !isFixOlderThan(fix, FIX_STALE_MS),
    isStale: isFixOlderThan(fix, FIX_STALE_MS),
    permissionDenied: permission === 'denied',
  };
}
