/**
 * Pure AndroidManifest.xml string helpers (checked-in android/ trees).
 */

const TOOLS_NS = 'http://schemas.android.com/tools';

function ensureToolsNamespace(xml) {
  const source = String(xml);
  if (/xmlns:tools\s*=/.test(source)) return source;
  return source.replace(
    /<manifest\b([^>]*)>/,
    `<manifest$1 xmlns:tools="${TOOLS_NS}">`,
  );
}

/**
 * True when a uses-permission entry for `permission` already has tools:node="remove"
 * (attribute order independent).
 */
function hasPermissionRemove(xml, permission) {
  const name = permission.replace(/\./g, '\\.');
  const re = new RegExp(
    `<uses-permission\\b[^>]*android:name="${name}"[^>]*tools:node="remove"[^>]*/>|<uses-permission\\b[^>]*tools:node="remove"[^>]*android:name="${name}"[^>]*/>`,
  );
  return re.test(String(xml));
}

/**
 * Drop positive (non-remove) declarations and ensure one tools:node="remove" line.
 */
function ensurePermissionRemove(xml, permission) {
  let source = String(xml);
  const nameEsc = permission.replace(/\./g, '\\.');
  // Remove any uses-permission for this name that is NOT already a remove directive.
  source = source.replace(
    new RegExp(`\\s*<uses-permission\\b[^>]*android:name="${nameEsc}"[^>]*/>`, 'g'),
    (match) => (/\btools:node\s*=\s*["']remove["']/.test(match) ? match : ''),
  );
  if (!hasPermissionRemove(source, permission)) {
    const removeLine = `  <uses-permission android:name="${permission}" tools:node="remove"/>`;
    source = source.replace(/(<manifest\b[^>]*>)/, `$1\n${removeLine}`);
  }
  return source;
}

function ensureNotificationsReceiverOverride(xml) {
  let source = String(xml);
  if (source.includes('expo.modules.notifications.service.NotificationsService')) {
    if (
      source.includes('tools:node="replace"') &&
      source.includes('expo.modules.notifications.NOTIFICATION_EVENT') &&
      !source.match(/NotificationsService[\s\S]*?BOOT_COMPLETED[\s\S]*?<\/receiver>/)
    ) {
      return source;
    }
  }
  const block = `
    <receiver
      android:name="expo.modules.notifications.service.NotificationsService"
      android:enabled="true"
      android:exported="false"
      tools:node="merge">
      <intent-filter android:priority="-1" tools:node="replace">
        <action android:name="expo.modules.notifications.NOTIFICATION_EVENT"/>
        <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
      </intent-filter>
    </receiver>`;
  if (source.includes('</application>')) {
    return source.replace('</application>', `${block}\n  </application>`);
  }
  return source;
}

module.exports = {
  TOOLS_NS,
  ensureToolsNamespace,
  hasPermissionRemove,
  ensurePermissionRemove,
  ensureNotificationsReceiverOverride,
};
