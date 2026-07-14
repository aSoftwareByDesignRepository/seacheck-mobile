#!/usr/bin/env bash
# Validates F-Droid / standalone-repo assumptions (no monorepo ../shared paths).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Metro config loads in standalone repo"
SEACHECK_APP_VARIANT=production NODE_ENV=production node -e "require('./metro.config.js')"

if grep -qE '\.\./shared/' metro.config.js 2>/dev/null; then
  echo "ERROR: metro.config.js must not require ../shared/ (F-Droid clones this repo alone)" >&2
  exit 1
fi

echo "==> F-Droid build scripts present"
required=(
  scripts/fdroid-init.gradle
  scripts/fdroid-strip-node-prebuilts.sh
  scripts/patch-expo-constants-env.sh
  scripts/ensure-android-local-properties.sh
  docs/fdroid/de.softwarebydesign.seacheck.yml
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "==> Production app.config (SEACHECK_APP_VARIANT=production)"
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo config --type public >/dev/null

echo "==> F-Droid metadata APK output (RN 0.85+ single APK per reactNativeArchitectures)"
if grep -qE 'app-(armeabi-v7a|arm64-v8a|x86_64)-release-unsigned\.apk' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata output must be app-release-unsigned.apk (RN 0.85 removed per-ABI split APK names)" >&2
  exit 1
fi
if ! grep -q 'app-release-unsigned.apk' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata must declare app-release-unsigned.apk output" >&2
  exit 1
fi
if grep -q 'enableSeparateBuildPerCPUArchitecture' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata must not reference enableSeparateBuildPerCPUArchitecture (removed in RN 0.85)" >&2
  exit 1
fi

echo "==> F-Droid metadata versionCode (multi-arch VercodeOperation)"
if ! grep -q 'versionCode: \$\$VERCODE\$\$' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata must patch app.config.ts with versionCode: \$\$VERCODE\$\$ before expo prebuild" >&2
  exit 1
fi

echo "==> F-Droid metadata rewritemeta line wrapping (ApplicationModule.kt path)"
if grep -q "getInstallReferrerAsync.*ApplicationModule.kt" docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: ApplicationModule.kt path must be on its own prebuild line (fdroid rewritemeta)" >&2
  exit 1
fi

echo "==> F-Droid metadata AntiFeatures reason line wrapping"
if grep -q 'while downloading offline region packs\.' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: NonFreeNet en-US reason must be line-wrapped (fdroid rewritemeta)" >&2
  exit 1
fi
if grep -q 'beim Herunterladen von Offline-Regionen\.' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: NonFreeNet de-DE reason must be line-wrapped (fdroid rewritemeta)" >&2
  exit 1
fi

echo "==> F-Droid store listing disclosures (fastlane full_description)"
for locale_file in \
  fastlane/metadata/android/en-US/full_description.txt \
  fastlane/metadata/android/de-DE/full_description.txt
do
  [[ -f "$locale_file" ]] || { echo "Missing: $locale_file"; exit 1; }
done
if ! grep -qi 'background location\|background.*permission\|screen is off\|screen off' fastlane/metadata/android/en-US/full_description.txt; then
  echo "ERROR: en-US full_description must disclose optional background location use" >&2
  exit 1
fi
if ! grep -qi 'Hintergrund-Standort\|Hintergrund.*Standort\|Bildschirm' fastlane/metadata/android/de-DE/full_description.txt; then
  echo "ERROR: de-DE full_description must disclose optional background location use" >&2
  exit 1
fi
if grep -qi 'BackgroundLocation:' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: BackgroundLocation is not a valid F-Droid AntiFeature; disclose in fastlane full_description instead" >&2
  exit 1
fi

echo "==> F-Droid non-free APK patches"
required_patch=(
  scripts/patch-fdroid-nonfree.sh
  scripts/fdroid/expo-notifications-patches/tokens/PushTokenModule.kt
  scripts/fdroid/expo-location-patches/LocationModule.kt
  scripts/fdroid/maplibre-react-native-patches/build.gradle
)
for f in "${required_patch[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done
if grep -q 'firebase-stub@' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata must use scripts/patch-fdroid-nonfree.sh, not firebase-stub (check apk rejects com/google/firebase and com/google/android/gms)" >&2
  exit 1
fi
if ! grep -q 'patch-fdroid-nonfree.sh' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: metadata must run scripts/patch-fdroid-nonfree.sh before expo prebuild" >&2
  exit 1
fi
if grep -q 'node_modules/expo-location/android/build.gradle' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: remove obsolete scanignore for expo-location (patch-fdroid-nonfree.sh strips play-services; unused scanignore fails fdroid build)" >&2
  exit 1
fi
if grep -q 'node_modules/@maplibre/maplibre-react-native/android/build.gradle' docs/fdroid/de.softwarebydesign.seacheck.yml; then
  echo "ERROR: remove maplibre scanignore (patch-fdroid-nonfree.sh removes play-services-location; unused scanignore fails fdroid build)" >&2
  exit 1
fi
if [[ -f scripts/fdroid/expo-notifications-patches/notifications/interfaces/NotificationListener.java ]]; then
  echo "ERROR: remove NotificationListener.java patch (expo-notifications uses .kt; duplicate fails compileReleaseKotlin)" >&2
  exit 1
fi
if ! grep -q 'removeBackgroundTaskConsumer' scripts/fdroid/expo-notifications-patches/service/delegates/FirebaseMessagingDelegate.kt; then
  echo "ERROR: FirebaseMessagingDelegate stub must define removeBackgroundTaskConsumer" >&2
  exit 1
fi

echo "F-Droid preflight passed."
