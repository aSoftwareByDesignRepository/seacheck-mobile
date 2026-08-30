/**
 * Directly patch a checked-in android/ tree (no expo prebuild required).
 * Mirrors the config plugin so Play-bound AABs pick up fixes immediately.
 */
const fs = require('fs');
const path = require('path');
const { resolveProps } = require('./policy');
const {
  ensureToolsNamespace,
  ensurePermissionRemove,
  ensureNotificationsReceiverOverride,
} = require('./manifestXml');
const { enableR8GradleProperties } = require('./gradleProps');
const { enableProguardOptimize } = require('./appBuildGradle');
const { findStylesXmlPaths, stripStylesFile } = require('./stylesFiles');

function patchStyles(stylesPath) {
  return stripStylesFile(stylesPath);
}

function patchGradleProperties(propsPath) {
  if (!fs.existsSync(propsPath)) return false;
  let text = fs.readFileSync(propsPath, 'utf8');
  const before = text;
  text = enableR8GradleProperties(text);
  if (text !== before) {
    fs.writeFileSync(propsPath, text);
    return true;
  }
  return false;
}

function patchAppBuildGradle(buildGradlePath) {
  if (!fs.existsSync(buildGradlePath)) return false;
  let text = fs.readFileSync(buildGradlePath, 'utf8');
  const before = text;
  text = enableProguardOptimize(text);
  if (text !== before) {
    fs.writeFileSync(buildGradlePath, text);
    return true;
  }
  return false;
}

function ensureProguardBasics(proguardPath) {
  const dir = path.dirname(proguardPath);
  // Incomplete trees (tests / partial prebuilds) may lack android/app yet.
  if (!fs.existsSync(dir)) return false;
  const basics = `# React Native / Hermes (R8)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class expo.modules.** { *; }
-dontwarn com.facebook.react.**
-dontwarn okhttp3.**
-dontwarn okio.**
`;
  if (!fs.existsSync(proguardPath)) {
    fs.writeFileSync(proguardPath, basics);
    return true;
  }
  let text = fs.readFileSync(proguardPath, 'utf8');
  if (!text.includes('com.facebook.react.**')) {
    fs.writeFileSync(proguardPath, `${text.trimEnd()}\n\n${basics}`);
    return true;
  }
  return false;
}

function patchAndroidTree(appRoot, props = {}) {
  const resolved = resolveProps(props);
  const androidRoot = path.join(appRoot, 'android');
  if (!fs.existsSync(androidRoot)) {
    return { skipped: true, reason: 'no-android' };
  }
  const changes = [];
  const manifestPath = path.join(androidRoot, 'app/src/main/AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    let xml = fs.readFileSync(manifestPath, 'utf8');
    const before = xml;
    xml = ensureToolsNamespace(xml);
    if (resolved.removeSystemAlertWindow !== false) {
      xml = ensurePermissionRemove(xml, 'android.permission.SYSTEM_ALERT_WINDOW');
    }
    if (resolved.removeReceiveBootCompleted) {
      xml = ensurePermissionRemove(xml, 'android.permission.RECEIVE_BOOT_COMPLETED');
    }
    if (resolved.stripNotificationBoot) {
      xml = ensureNotificationsReceiverOverride(xml);
    }
    if (xml !== before) {
      fs.writeFileSync(manifestPath, xml);
      changes.push('AndroidManifest.xml');
    }
  }
  if (resolved.fixEdgeToEdgeStyles !== false) {
    const resRoot = path.join(androidRoot, 'app/src/main/res');
    const stylePaths = findStylesXmlPaths(resRoot);
    let stylesChanged = false;
    for (const stylesPath of stylePaths) {
      if (patchStyles(stylesPath)) stylesChanged = true;
    }
    if (stylesChanged) changes.push('styles.xml');
  }
  if (resolved.enableR8 !== false) {
    if (patchGradleProperties(path.join(androidRoot, 'gradle.properties'))) {
      changes.push('gradle.properties');
    }
    if (patchAppBuildGradle(path.join(androidRoot, 'app/build.gradle'))) {
      changes.push('app/build.gradle');
    }
    if (ensureProguardBasics(path.join(androidRoot, 'app/proguard-rules.pro'))) {
      changes.push('proguard-rules.pro');
    }
  }
  return { skipped: false, changes };
}

module.exports = {
  patchAndroidTree,
  ensurePermissionRemove,
  ensureNotificationsReceiverOverride,
  patchStyles,
  patchGradleProperties,
  patchAppBuildGradle,
  ensureToolsNamespace,
  findStylesXmlPaths,
  stripStylesFile,
};
