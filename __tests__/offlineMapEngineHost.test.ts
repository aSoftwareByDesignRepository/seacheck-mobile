import { Platform } from 'react-native';

import {
  ensureOfflineMapEnginePrimedBeforeDownload,
  ensureOfflineMapEngineReadyForDownload,
  ensureOfflineMapEngineStyle,
  getOfflineMapEngineStyleReloadNonce,
  isOfflineMapEngineStyleLoaded,
  isOfflineMapEngineViewportPrimed,
  markOfflineMapEngineStyleLoaded,
  markOfflineMapEngineViewportPrimed,
  requestOfflineMapEngineStyleReload,
  requestOfflineMapEngineViewport,
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

  it('tracks viewport priming separately from style load', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style.json';
    const viewport = { center: [10.15, 54.32] as [number, number], zoom: 10 };
    markOfflineMapEngineStyleLoaded(styleUri);
    expect(isOfflineMapEngineViewportPrimed(viewport)).toBe(false);

    requestOfflineMapEngineViewport(viewport);
    markOfflineMapEngineViewportPrimed(viewport);
    expect(isOfflineMapEngineViewportPrimed(viewport)).toBe(true);

    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('re-aims viewport even when style is already loaded', async () => {
    jest.useFakeTimers();
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    const styleUri = 'file:///data/chart-style-ready.json';
    const viewport = { center: [10.15, 54.32] as [number, number], zoom: 10 };
    markOfflineMapEngineStyleLoaded(styleUri);

    const pending = ensureOfflineMapEngineReadyForDownload(styleUri, viewport);
    await jest.advanceTimersByTimeAsync(400);
    markOfflineMapEngineViewportPrimed(viewport);
    await pending;

    expect(isOfflineMapEngineViewportPrimed(viewport)).toBe(true);

    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  }, 15_000);

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
