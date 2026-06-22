import { useEffect, useState } from 'react';

import { useNavigationStore } from '../store/navigationStore';

export function useRaceCountdown(): {
  remainingMs: number | null;
  isActive: boolean;
  isStarted: boolean;
} {
  const raceStartAtMs = useNavigationStore((s) => s.raceStartAtMs);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!raceStartAtMs) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [raceStartAtMs]);

  if (!raceStartAtMs) {
    return { remainingMs: null, isActive: false, isStarted: false };
  }

  const remainingMs = raceStartAtMs - now;
  return {
    remainingMs: Math.max(0, remainingMs),
    isActive: remainingMs > 0,
    isStarted: remainingMs <= 0,
  };
}
