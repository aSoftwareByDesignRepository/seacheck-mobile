/**
 * Pure Android 15 / Play compliance policy (no Expo dependency).
 */

const SAW = 'android.permission.SYSTEM_ALERT_WINDOW';
const BOOT = 'android.permission.RECEIVE_BOOT_COMPLETED';
const NOTIFICATIONS_RECEIVER = 'expo.modules.notifications.service.NotificationsService';

const POLICY = {
  SAW,
  BOOT,
  NOTIFICATIONS_RECEIVER,
  /**
   * Android 15 BOOT_COMPLETED may not start these FGS types.
   * `location` is intentionally absent — TaskManager may restart it after boot.
   */
  restrictedBootFgsTypes: Object.freeze([
    'dataSync',
    'camera',
    'mediaPlayback',
    'phoneCall',
    'mediaProjection',
    'microphone',
  ]),
  isRestrictedBootFgsType(type) {
    return POLICY.restrictedBootFgsTypes.includes(String(type));
  },
  profiles: Object.freeze({
    standard: Object.freeze({
      removeSystemAlertWindow: true,
      fixEdgeToEdgeStyles: true,
      enableR8: true,
      stripNotificationBoot: false,
      removeReceiveBootCompleted: false,
    }),
    stripNotificationBoot: Object.freeze({
      removeSystemAlertWindow: true,
      fixEdgeToEdgeStyles: true,
      enableR8: true,
      stripNotificationBoot: true,
      removeReceiveBootCompleted: true,
    }),
    keepBoot: Object.freeze({
      removeSystemAlertWindow: true,
      fixEdgeToEdgeStyles: true,
      enableR8: true,
      stripNotificationBoot: false,
      removeReceiveBootCompleted: false,
    }),
  }),
};

function resolveProps(props = {}) {
  const profileName = props.profile && POLICY.profiles[props.profile] ? props.profile : null;
  const base = profileName ? { ...POLICY.profiles[profileName] } : { ...POLICY.profiles.standard };
  const { profile: _profile, ...rest } = props;
  return { ...base, ...rest };
}

module.exports = {
  POLICY,
  resolveProps,
  SAW,
  BOOT,
  NOTIFICATIONS_RECEIVER,
};
