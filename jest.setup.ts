import 'whatwg-fetch';

jest.spyOn(global.console, 'warn').mockImplementation(() => {});

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
  Accuracy: { BestForNavigation: 6 },
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

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => {}),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => {}),
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
}));

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: React.forwardRef(({ children }: { children?: React.ReactNode }, _ref: unknown) =>
      React.createElement(View, { testID: 'maplibre.map' }, children),
    ),
    Camera: () => null,
    UserLocation: () => null,
    LocationManager: {
      requestPermissions: jest.fn(async () => true),
      start: jest.fn(),
      stop: jest.fn(),
    },
    OfflineManager: {
      getPacks: jest.fn(async () => []),
      createPack: jest.fn(async (_opts: unknown, onProgress: (p: { id: string }, s: { state: string; percentage: number }) => void) => {
        const pack = {
          id: 'mock-pack',
          metadata: {},
          bounds: [0, 0, 0, 0],
          status: async () => ({
            id: 'mock-pack',
            state: 'complete',
            percentage: 100,
            completedResourceCount: 1,
            completedResourceSize: 1,
            completedTileCount: 1,
            completedTileSize: 1,
            requiredResourceCount: 1,
          }),
        };
        onProgress(pack, { state: 'complete', percentage: 100 });
        return pack;
      }),
      deletePack: jest.fn(async () => {}),
    },
    useCurrentPosition: jest.fn(() => undefined),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});
