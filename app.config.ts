import { ExpoConfig, ConfigContext } from 'expo/config';

import withAndroidReleaseSigning from './plugins/withAndroidReleaseSigning';
import withAndroidNodePath from './plugins/withAndroidNodePath';

const isProductionBuild = process.env.SEACHECK_APP_VARIANT === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SeaCheck',
  slug: 'seacheck',
  version: '0.1.0',
  orientation: 'default',
  scheme: 'seacheck',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ...( {
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0b1622',
    },
  } as any),
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'de.softwarebydesign.seacheck',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'SeaCheck shows your position on the chart and underway instruments (COG, SOG, bearing).',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'SeaCheck monitors anchor alarms and records tracks while the app is in the background.',
      UIBackgroundModes: ['location'],
    },
  },
  android: {
    package: 'de.softwarebydesign.seacheck',
    adaptiveIcon: {
      backgroundColor: '#0b1622',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'INTERNET',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      'WAKE_LOCK',
      'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ],
    // expo-sensors bundles ACTIVITY_RECOGNITION for Pedometer; SeaCheck only uses Barometer.
    blockedPermissions: [
      'android.permission.ACTIVITY_RECOGNITION',
      'com.google.android.gms.permission.ACTIVITY_RECOGNITION',
    ],
  },
  plugins: [
    ...(isProductionBuild ? [] : (['expo-dev-client'] as const)),
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SeaCheck shows your position on the chart and underway instruments (COG, SOG, bearing).',
        locationAlwaysAndWhenInUsePermission:
          'SeaCheck monitors anchor alarms and records tracks while the app is in the background.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isAndroidMotionActivityEnabled: false,
      },
    ],
    'expo-sqlite',
    'expo-sharing',
    'expo-audio',
    'expo-font',
    'expo-asset',
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#0073ad',
      },
    ],
    ['@maplibre/maplibre-react-native', { android: {}, ios: { metalEnabled: true } }],
    withAndroidReleaseSigning,
    withAndroidNodePath,
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
