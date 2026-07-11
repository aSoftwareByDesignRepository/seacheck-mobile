import {
  ensureMaritimeAlarmNotifications,
  initMaritimeAlarmNotifications,
} from '../../services/maritimeAlarmNotifications';

type InitOptions = {
  /** Ask for notification permission (onboarding finish). */
  requestNotifications?: boolean;
};

/** Idempotent startup for alarms, notifications, and background GPS monitoring. Never throws. */
export async function initializeAppServices(options: InitOptions = {}): Promise<{ ok: boolean; reason?: string }> {
  try {
    await initMaritimeAlarmNotifications();
    if (options.requestNotifications) {
      const granted = await ensureMaritimeAlarmNotifications();
      if (!granted) {
        return { ok: false, reason: 'notifications_denied' };
      }
    }
    const { useLocationStore } = await import('../../services/locationService');
    await useLocationStore.getState().refreshPermission();
    const { syncBackgroundLocationMonitoring } = await import('../../services/backgroundLocationService');
    const sync = await syncBackgroundLocationMonitoring();
    if (!sync.ok) {
      console.warn('[initializeAppServices] background location sync failed', sync.reason);
    }
    return sync.ok ? { ok: true } : { ok: false, reason: sync.reason };
  } catch (error) {
    console.warn('[initializeAppServices] startup failed', error);
    return { ok: false, reason: 'init_failed' };
  }
}
