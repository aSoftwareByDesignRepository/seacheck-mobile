import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshAnchorWatchPromptIfNeeded } from '../lib/anchor/activateAnchorAlarm';
import { refreshMaritimeNotificationPermission } from '../services/maritimeAlarmNotifications';
import { useLocationStore } from '../services/locationService';
import { useOfflinePackStore } from '../store/offlinePackStore';

/** Re-sync background GPS and anchor-watch status when returning from system settings. */
export function useResumeBackgroundSync() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        await useLocationStore.getState().refreshPermission();
        await refreshMaritimeNotificationPermission();
        const { syncBackgroundLocationMonitoring } = await import('../services/backgroundLocationService');
        await syncBackgroundLocationMonitoring();
        await useLocationStore.getState().startWatching({ requestIfUndetermined: false });
        await refreshAnchorWatchPromptIfNeeded();
        await useOfflinePackStore.getState().retryPendingSeamarkIndexing();
      })();
    });
    return () => sub.remove();
  }, []);
}
