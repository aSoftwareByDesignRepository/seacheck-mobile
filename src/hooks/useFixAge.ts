import { useEffect, useState } from 'react';

import { FIX_AGING_MS, FIX_STALE_MS, fixAgeSeconds } from '../lib/geo/fixAge';
import { useLocationStore } from '../services/locationService';

function fixAgeTickIntervalMs(
  fix: NonNullable<ReturnType<typeof useLocationStore.getState>['fix']>,
  nowMs: number,
): number {
  const ageMs = nowMs - fix.timestamp;
  if (ageMs >= FIX_STALE_MS) return 5000;
  if (ageMs >= FIX_AGING_MS) return 1000;
  const untilAging = FIX_AGING_MS - ageMs;
  return untilAging > 5000 ? 5000 : 1000;
}

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
    if (!fix) {
      setNow(Date.now());
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const tickAt = Date.now();
      setNow(tickAt);
      timeout = setTimeout(schedule, fixAgeTickIntervalMs(fix, tickAt));
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [fix]);

  return {
    ageSec: fixAgeSeconds(fix, now),
    isAging: fix != null && now - fix.timestamp > FIX_AGING_MS && now - fix.timestamp <= FIX_STALE_MS,
    isStale: fix != null && now - fix.timestamp > FIX_STALE_MS,
    permissionDenied: permission === 'denied',
  };
}
