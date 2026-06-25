import { useEffect } from 'react';

import { useLocationStore } from '../services/locationService';

/** Keeps foreground GPS active for the whole app session (map, alarms, tracks). */
export function useAppLocationWatch() {
  const startWatching = useLocationStore((s) => s.startWatching);
  const refreshPermission = useLocationStore((s) => s.refreshPermission);
  const permission = useLocationStore((s) => s.permission);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (permission === 'denied') return;
    void startWatching();
  }, [permission, startWatching]);
}
