import { Platform } from 'react-native';

import {
  ensureOfflineMapEnginePrimedBeforeDownload,
  ensureOfflineMapEngineStyle,
  getOfflineMapEngineStyleReloadNonce,
  isOfflineMapEngineStyleLoaded,
  markOfflineMapEngineStyleLoaded,
  requestOfflineMapEngineStyleReload,
  resetOfflineMapEngineHostForTests,
  waitForOfflineMapEngineStyle,
} from '../src/lib/offline/offlineMapEngineHost';

describe('offlineMapEngineHost', () => {
  beforeEach(() => {
    resetOfflineMapEngineHostForTests();
  });

  it('resolves immediately on iOS', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    await expect(waitForOfflineMapEngineStyle('file:///style.json')).resolves.toBe(true);
    await expect(ensureOfflineMapEngineStyle('file:///style.json')).resolves.toBeUndefined();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('waits for the hidden map host on Android', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style.json';
    const pending = waitForOfflineMapEngineStyle(styleUri);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(false);

    markOfflineMapEngineStyleLoaded(styleUri);
    await expect(pending).resolves.toBe(true);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(true);

    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('ignores stale style-loaded callbacks after reload', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style.json';
    markOfflineMapEngineStyleLoaded(styleUri, 0);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(true);

    requestOfflineMapEngineStyleReload();
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(false);

    markOfflineMapEngineStyleLoaded(styleUri, 0);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(false);

    markOfflineMapEngineStyleLoaded(styleUri, 1);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(true);

    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('remounts before download when the hidden host is not primed', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style-download.json';
    void ensureOfflineMapEnginePrimedBeforeDownload(styleUri);
    expect(getOfflineMapEngineStyleReloadNonce()).toBe(1);
    expect(isOfflineMapEngineStyleLoaded(styleUri)).toBe(false);

    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('throws when Android style never loads after retries', async () => {
    jest.useFakeTimers();
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style-missing.json';
    let caught: Error | undefined;
    const pending = ensureOfflineMapEngineStyle(styleUri).catch((error: Error) => {
      caught = error;
    });

    await jest.advanceTimersByTimeAsync(20_000 * 4 + 350 * 4);
    await pending;
    expect(caught?.message).toContain('Chart engine did not start');

    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  }, 15_000);
});
