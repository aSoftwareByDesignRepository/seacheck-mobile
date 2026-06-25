import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshAnchorWatchPromptIfNeeded } from '../lib/anchor/activateAnchorAlarm';
import { useLocationStore } from '../services/locationService';

/** Re-sync background GPS and anchor-watch status when returning from system settings. */
export function useResumeBackgroundSync() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        await useLocationStore.getState().refreshPermission();
        const { syncBackgroundLocationMonitoring } = await import('../services/backgroundLocationService');
        await syncBackgroundLocationMonitoring();
        await refreshAnchorWatchPromptIfNeeded();
      })();
    });
    return () => sub.remove();
  }, []);
}
