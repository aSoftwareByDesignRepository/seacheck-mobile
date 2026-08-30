/**
 * Expo config-plugin style AndroidManifest object helpers (no Expo import).
 */

const { SAW, BOOT, NOTIFICATIONS_RECEIVER } = require('./policy');

function ensureToolsNamespace(androidManifest) {
  if (!androidManifest.manifest.$) androidManifest.manifest.$ = {};
  if (!androidManifest.manifest.$['xmlns:tools']) {
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function forceRemovePermission(androidManifest, permission) {
  const root = androidManifest.manifest;
  if (!root['uses-permission']) root['uses-permission'] = [];
  root['uses-permission'] = root['uses-permission'].filter(
    (entry) => entry?.$?.['android:name'] !== permission,
  );
  root['uses-permission'].push({
    $: {
      'android:name': permission,
      'tools:node': 'remove',
    },
  });
}

/**
 * @param {object} androidManifest
 * @param {(manifest: object) => object} getMainApplication — inject Expo's getter in production
 */
function stripBootActionsFromNotificationsReceiver(androidManifest, getMainApplication) {
  if (typeof getMainApplication !== 'function') {
    throw new TypeError('getMainApplication is required');
  }
  const app = getMainApplication(androidManifest);
  const receivers = app.receiver ?? [];
  if (!Array.isArray(app.receiver)) {
    app.receiver = receivers;
  }

  let receiver = receivers.find((entry) => entry?.$?.['android:name'] === NOTIFICATIONS_RECEIVER);
  if (!receiver) {
    receiver = {
      $: {
        'android:name': NOTIFICATIONS_RECEIVER,
        'android:enabled': 'true',
        'android:exported': 'false',
        'tools:node': 'merge',
      },
      'intent-filter': [],
    };
    receivers.push(receiver);
  } else {
    receiver.$ = {
      ...(receiver.$ ?? {}),
      'android:enabled': 'true',
      'android:exported': 'false',
      'tools:node': 'merge',
    };
  }

  receiver['intent-filter'] = [
    {
      $: { 'android:priority': '-1', 'tools:node': 'replace' },
      action: [
        { $: { 'android:name': 'expo.modules.notifications.NOTIFICATION_EVENT' } },
        { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
      ],
    },
  ];
}

function applyPlayComplianceToManifestObject(androidManifest, props, getMainApplication) {
  ensureToolsNamespace(androidManifest);
  if (props.removeSystemAlertWindow !== false) {
    forceRemovePermission(androidManifest, SAW);
  }
  if (props.stripNotificationBoot) {
    stripBootActionsFromNotificationsReceiver(androidManifest, getMainApplication);
  }
  if (props.removeReceiveBootCompleted) {
    forceRemovePermission(androidManifest, BOOT);
  }
  return androidManifest;
}

module.exports = {
  ensureToolsNamespace,
  forceRemovePermission,
  stripBootActionsFromNotificationsReceiver,
  applyPlayComplianceToManifestObject,
};
