import { ExpoConfig, ConfigContext } from 'expo/config';

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
        'SeaCheck records your track while the app is in the background during a passage.',
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
    ],
  },
  plugins: [
    'expo-dev-client',
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SeaCheck shows your position on the chart and underway instruments (COG, SOG, bearing).',
        locationAlwaysAndWhenInUsePermission:
          'SeaCheck records your track while the app is in the background during a passage.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-sqlite',
    'expo-sharing',
    'expo-audio',
    'expo-haptics',
    ['@maplibre/maplibre-react-native', { android: {}, ios: { metalEnabled: true } }],
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
