import { useEffect, useState } from 'react';

import { useNavigationStore } from '../store/navigationStore';

export function useLegTimerMs(): number | null {
  const startedAt = useNavigationStore((s) => s.legTimerStartedAtMs);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  return Math.max(0, now - startedAt);
}
