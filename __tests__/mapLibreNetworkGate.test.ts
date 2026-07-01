import { NetworkManager } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

import { ensureMapLibreNetworkForDownload, syncMapLibreNetworkState } from '../src/lib/network/mapLibreNetworkGate';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';

const setConnected = NetworkManager.setConnected as jest.Mock;

describe('mapLibreNetworkGate', () => {
  const platform = Platform.OS;

  beforeEach(() => {
    setConnected.mockClear();
    downloadCoordinator.end('kiel-bay');
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  });

  it('forces MapLibre online on Android for downloads', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    ensureMapLibreNetworkForDownload();
    expect(setConnected).toHaveBeenCalledWith(true);
  });

  it('keeps MapLibre online during preflight lock even when disconnected', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    downloadCoordinator.preflightLock('kiel-bay');
    syncMapLibreNetworkState(true, true);
    expect(setConnected).toHaveBeenCalledWith(true);
    downloadCoordinator.releasePreflightLock('kiel-bay');
    syncMapLibreNetworkState(true, false);
    expect(setConnected).toHaveBeenLastCalledWith(false);
  });
});
