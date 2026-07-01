import { NetworkManager } from '@maplibre/maplibre-react-native';
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useMapLibreNetworkSync } from '../src/hooks/useMapLibreNetworkSync';

jest.mock('../src/lib/network/connectivity', () => ({
  useIsDeviceDisconnected: jest.fn(() => false),
}));

jest.mock('../src/store/offlinePackStore', () => ({
  useOfflinePackStore: jest.fn((selector: (s: {
    activeDownloadRegionId: string | null;
    regions: Record<string, { state: string }>;
  }) => unknown) =>
    selector({ activeDownloadRegionId: null, regions: {} }),
  ),
}));

const useIsDeviceDisconnected = require('../src/lib/network/connectivity').useIsDeviceDisconnected as jest.Mock;
const useOfflinePackStore = require('../src/store/offlinePackStore').useOfflinePackStore as jest.Mock;
const setConnected = NetworkManager.setConnected as jest.Mock;

function mockStore(activeDownloadRegionId: string | null, regions: Record<string, { state: string }> = {}) {
  useOfflinePackStore.mockImplementation((selector: (s: {
    activeDownloadRegionId: string | null;
    regions: Record<string, { state: string }>;
  }) => unknown) => selector({ activeDownloadRegionId, regions }));
}

describe('useMapLibreNetworkSync', () => {
  const platform = Platform.OS;

  beforeEach(() => {
    setConnected.mockClear();
    useIsDeviceDisconnected.mockReturnValue(false);
    mockStore(null);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  });

  it('enables MapLibre network on Android when online', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    renderHook(() => useMapLibreNetworkSync());
    expect(setConnected).toHaveBeenCalledWith(true);
  });

  it('disables MapLibre network on Android when disconnected', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useIsDeviceDisconnected.mockReturnValue(true);
    renderHook(() => useMapLibreNetworkSync());
    expect(setConnected).toHaveBeenCalledWith(false);
  });

  it('keeps MapLibre network on during an active download even when disconnected', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useIsDeviceDisconnected.mockReturnValue(true);
    mockStore('kiel-bay');
    renderHook(() => useMapLibreNetworkSync());
    expect(setConnected).toHaveBeenCalledWith(true);
  });

  it('keeps MapLibre network on when a region is downloading without activeDownloadRegionId', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useIsDeviceDisconnected.mockReturnValue(true);
    mockStore(null, { 'kiel-bay': { state: 'downloading' } });
    renderHook(() => useMapLibreNetworkSync());
    expect(setConnected).toHaveBeenCalledWith(true);
  });

  it('does not call setConnected on iOS', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    renderHook(() => useMapLibreNetworkSync());
    expect(setConnected).not.toHaveBeenCalled();
  });
});
