import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { t } from '../i18n';

export type MaritimeNotificationPermission = 'unknown' | 'granted' | 'denied';

const ALARM_CHANNEL_ID = 'maritime-alarms-v2';

let handlerRegistered = false;
let permissionStatus: MaritimeNotificationPermission = 'unknown';

function isPermissionGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export function getMaritimeNotificationPermission(): MaritimeNotificationPermission {
  return permissionStatus;
}

export async function refreshMaritimeNotificationPermission(): Promise<MaritimeNotificationPermission> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (isPermissionGranted(current)) {
      permissionStatus = 'granted';
    } else if (current.status === 'denied') {
      permissionStatus = 'denied';
    } else {
      permissionStatus = 'unknown';
    }
  } catch {
    permissionStatus = 'denied';
  }
  return permissionStatus;
}

export async function ensureMaritimeAlarmNotifications(): Promise<boolean> {
  await refreshMaritimeNotificationPermission();
  if (permissionStatus === 'granted') return true;
  if (permissionStatus === 'denied') return false;

  try {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    permissionStatus = isPermissionGranted(requested) ? 'granted' : 'denied';
  } catch {
    permissionStatus = 'denied';
  }
  return permissionStatus === 'granted';
}

export async function openMaritimeNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function initMaritimeAlarmNotifications(): Promise<void> {
  if (handlerRegistered) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isAlarm = notification.request.content.data?.type === 'maritime_alarm';
        return {
          shouldShowBanner: isAlarm,
          shouldShowList: isAlarm,
          shouldPlaySound: isAlarm,
          shouldSetBadge: false,
        };
      },
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: t('settings.alarmNotificationChannel'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 150, 400],
        enableVibrate: true,
      }).catch(() => {});
    }

    await refreshMaritimeNotificationPermission();
    handlerRegistered = true;
  } catch {
    permissionStatus = 'denied';
  }
}

export async function showMaritimeAlarmNotification(title: string, body: string): Promise<void> {
  const allowed = await ensureMaritimeAlarmNotifications();
  if (!allowed) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'maritime_alarm' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
      ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
    });
  } catch {
    /* notifications unavailable */
  }
}

/** Test-only reset. */
export function resetMaritimeAlarmNotificationsForTests(): void {
  handlerRegistered = false;
  permissionStatus = 'unknown';
}
