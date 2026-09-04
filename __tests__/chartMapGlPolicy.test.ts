import { Platform } from 'react-native';

import { downloadCoordinator, resetDownloadCoordinatorForTests } from '../src/lib/offline/downloadCoordinator';
import {
  claimEmbeddedChartMapSlot,
  releaseEmbeddedChartMapSlot,
  resetEmbeddedChartMapRegistryForTests,
} from '../src/lib/map/embeddedChartMapRegistry';
import {
  setMapScreenFocused,
  resetMapScreenFocusForTests,
} from '../src/lib/map/mapScreenFocus';
import {
  shouldMountDownloadMapSession,
  shouldMountEmbeddedChartMap,
  shouldMountNavigationChartMap,
  shouldMountOfflineMapEngineHost,
} from '../src/lib/map/chartMapGlPolicy';

describe('chartMapGlPolicy', () => {
  const platform = Platform.OS;

  beforeEach(() => {
    resetDownloadCoordinatorForTests();
    resetMapScreenFocusForTests();
    resetEmbeddedChartMapRegistryForTests();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    resetDownloadCoordinatorForTests();
    resetMapScreenFocusForTests();
    resetEmbeddedChartMapRegistryForTests();
  });

  it('mounts the navigation chart only while the Map tab is focused', () => {
    expect(shouldMountNavigationChartMap()).toBe(false);
    setMapScreenFocused(true);
    expect(shouldMountNavigationChartMap()).toBe(true);
    downloadCoordinator.tryBegin('kiel-bay');
    expect(shouldMountNavigationChartMap()).toBe(false);
  });

  it('mounts the hidden offline engine only off the Map tab without an exclusive download', () => {
    expect(shouldMountOfflineMapEngineHost()).toBe(true);
    setMapScreenFocused(true);
    expect(shouldMountOfflineMapEngineHost()).toBe(false);
    setMapScreenFocused(false);
    downloadCoordinator.tryBegin('kiel-bay');
    expect(shouldMountOfflineMapEngineHost()).toBe(false);
  });

  it('yields the hidden offline engine while an embedded preview is visible', () => {
    claimEmbeddedChartMapSlot('pack-preview-kiel-bay');
    expect(shouldMountOfflineMapEngineHost()).toBe(false);
    expect(shouldMountEmbeddedChartMap()).toBe(true);
    releaseEmbeddedChartMapSlot('pack-preview-kiel-bay');
    expect(shouldMountOfflineMapEngineHost()).toBe(true);
  });

  it('blocks embedded previews while the Map tab or download map owns GL', () => {
    expect(shouldMountEmbeddedChartMap()).toBe(true);
    setMapScreenFocused(true);
    expect(shouldMountEmbeddedChartMap()).toBe(false);
    setMapScreenFocused(false);
    downloadCoordinator.tryBegin('kiel-bay');
    expect(shouldMountEmbeddedChartMap()).toBe(false);
  });

  it('allows embedded previews during preflight before the download map mounts', () => {
    downloadCoordinator.preflightLock('kiel-bay');
    expect(shouldMountEmbeddedChartMap()).toBe(true);
    expect(shouldMountOfflineMapEngineHost()).toBe(true);
  });

  it('yields teardown-only download map when the Map tab is focused', () => {
    downloadCoordinator.beginMapTeardown('kiel-bay');
    expect(
      shouldMountDownloadMapSession('kiel-bay', { state: 'ready' }, null, 'kiel-bay'),
    ).toBe(true);
    setMapScreenFocused(true);
    expect(
      shouldMountDownloadMapSession('kiel-bay', { state: 'ready' }, null, 'kiel-bay'),
    ).toBe(false);
  });
});
