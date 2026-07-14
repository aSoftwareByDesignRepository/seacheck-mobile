#!/usr/bin/env bash
# Strip proprietary Google Play Services / Firebase from F-Droid node_modules builds.
# Applied in fdroiddata prebuild after npm ci, before expo prebuild.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NOTIF_PATCHES="$ROOT/scripts/fdroid/expo-notifications-patches"
LOC_PATCHES="$ROOT/scripts/fdroid/expo-location-patches"

echo "==> patch-fdroid-nonfree: expo-notifications (local notifications only)"
NOTIF_ANDROID="node_modules/expo-notifications/android"
sed -i -e '/firebase/d' "$NOTIF_ANDROID/build.gradle"
cp -a "$NOTIF_PATCHES/." "$NOTIF_ANDROID/src/main/java/expo/modules/notifications/"
# expo-notifications ships NotificationListener.kt; an old .java patch caused redeclaration.
rm -f "$NOTIF_ANDROID/src/main/java/expo/modules/notifications/notifications/interfaces/NotificationListener.java"
rm -f \
  "$NOTIF_ANDROID/src/main/java/expo/modules/notifications/notifications/RemoteMessageSerializer.java" \
  "$NOTIF_ANDROID/src/main/java/expo/modules/notifications/notifications/model/triggers/FirebaseNotificationTrigger.kt" \
  "$NOTIF_ANDROID/src/main/java/expo/modules/notifications/firebase-messaging/src/main/java/com/google/firebase/messaging/"*.java 2>/dev/null || true
rm -rf "$NOTIF_ANDROID/firebase-messaging" 2>/dev/null || true

echo "==> patch-fdroid-nonfree: expo-location (Android LocationManager)"
LOC_ANDROID="node_modules/expo-location/android"
sed -i -e '/play-services/d' -e '/com\.google\.android\.gms/d' "$LOC_ANDROID/build.gradle"
cp "$LOC_PATCHES/LocationHelpers.kt" \
  "$LOC_ANDROID/src/main/java/expo/modules/location/LocationHelpers.kt"
cp "$LOC_PATCHES/LocationModule.kt" \
  "$LOC_ANDROID/src/main/java/expo/modules/location/LocationModule.kt"
cp "$LOC_PATCHES/taskConsumers/LocationTaskConsumer.kt" \
  "$LOC_ANDROID/src/main/java/expo/modules/location/taskConsumers/LocationTaskConsumer.kt"
cp "$LOC_PATCHES/taskConsumers/GeofencingTaskConsumer.kt" \
  "$LOC_ANDROID/src/main/java/expo/modules/location/taskConsumers/GeofencingTaskConsumer.kt"

echo "==> patch-fdroid-nonfree: maplibre-react-native (default location engine, no GMS)"
MAPLIBRE_ANDROID="node_modules/@maplibre/maplibre-react-native/android"
MAPLIBRE_PATCHES="$ROOT/scripts/fdroid/maplibre-react-native-patches"
cp "$MAPLIBRE_PATCHES/build.gradle" "$MAPLIBRE_ANDROID/build.gradle"
sed -i 's/^org\.maplibre\.reactnative\.locationEngine=.*/org.maplibre.reactnative.locationEngine=default/' \
  "$MAPLIBRE_ANDROID/gradle.properties"
rm -rf "$MAPLIBRE_ANDROID/src/main/location-engine-google"

echo "patch-fdroid-nonfree: done"
