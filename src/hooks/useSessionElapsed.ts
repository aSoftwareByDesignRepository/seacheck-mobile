import { useEffect, useState } from 'react';

import { useNavigationStore } from '../store/navigationStore';

/** Elapsed ms since session start (track recording or passage activation). */
export function useSessionElapsedMs(): number | null {
  const sessionStartedAtMs = useNavigationStore((s) => s.sessionStartedAtMs);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!sessionStartedAtMs) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionStartedAtMs]);

  if (!sessionStartedAtMs) return null;
  return Math.max(0, nowMs - sessionStartedAtMs);
}
