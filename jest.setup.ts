import 'whatwg-fetch';

jest.spyOn(global.console, 'warn').mockImplementation(() => {});
jest.spyOn(global.console, 'info').mockImplementation(() => {});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, String(value));
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => {}),
  stopLocationUpdatesAsync: jest.fn(async () => {}),
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { OtherNavigation: 3 },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium' },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(async () => {}) })),
  setAudioModeAsync: jest.fn(async () => {}),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'alarm-id'),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidNotificationPriority: { HIGH: 'high' },
  IosAuthorizationStatus: { PROVISIONAL: 2 },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => {}),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
  })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  cacheDirectory: 'file:///mock-cache/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  /** Default: plenty of free space so download tests are not blocked by fail-closed storageCheck. */
  getFreeDiskStorageAsync: jest.fn(async () => 8 * 1024 * 1024 * 1024),
}));

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: React.forwardRef(
      (
        {
          children,
          onDidFinishLoadingMap,
        }: {
          children?: React.ReactNode;
          onDidFinishLoadingMap?: () => void;
        },
        _ref: unknown,
      ) => {
        React.useEffect(() => {
          onDidFinishLoadingMap?.();
        }, [onDidFinishLoadingMap]);
        return React.createElement(View, { testID: 'maplibre.map' }, children);
      },
    ),
    Camera: () => null,
    UserLocation: () => null,
    LocationManager: {
      requestPermissions: jest.fn(async () => true),
      start: jest.fn(),
      stop: jest.fn(),
    },
    NetworkManager: {
      setConnected: jest.fn(),
    },
    TransformRequestManager: {
      addHeader: jest.fn(),
      removeHeader: jest.fn(),
    },
    OfflineManager: {
      getPacks: jest.fn(async () => []),
      addListener: jest.fn(async () => {}),
      setTileCountLimit: jest.fn(),
      setProgressEventThrottle: jest.fn(),
      setMaximumAmbientCacheSize: jest.fn(async () => {}),
      clearAmbientCache: jest.fn(async () => {}),
      invalidateAmbientCache: jest.fn(async () => {}),
      deletePack: jest.fn(async () => {}),
      createPack: jest.fn(async (opts: { metadata?: Record<string, unknown>; bounds?: number[] }, onProgress: (p: { id: string; resume: () => Promise<void>; pause: () => Promise<void>; status: () => Promise<unknown> }, s: Record<string, unknown>) => void) => {
        const pack = {
          id: 'mock-pack',
          metadata: { ...(opts?.metadata ?? {}) },
          bounds: opts?.bounds ?? [0, 0, 0, 0],
          resume: jest.fn(async () => {}),
          pause: jest.fn(async () => {}),
          status: async () => ({
            id: 'mock-pack',
            state: 'complete',
            percentage: 100,
            completedResourceCount: 10,
            completedResourceSize: 1000,
            completedTileCount: 8,
            completedTileSize: 800,
            requiredResourceCount: 10,
          }),
        };
        onProgress(pack, {
          state: 'complete',
          percentage: 100,
          requiredResourceCount: 10,
          completedResourceCount: 10,
          completedResourceSize: 1000,
          completedTileCount: 8,
          completedTileSize: 800,
        });
        return pack;
      }),
    },
    useCurrentPosition: jest.fn(() => undefined),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});
