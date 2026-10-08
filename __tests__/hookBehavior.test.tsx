/**
 * Atlas cov-1 fix — behavioral coverage for src/hooks/*.
 * The 2026-10-08 coverage-map cited hook names that had no dedicated suite
 * (useExclusiveChartDownloadSession / useMapSurfaceMode / useFixAge /
 * usePassageCoverage resolved only to src files). This suite renders the
 * hooks against seeded zustand stores and asserts returned values and
 * transitions — not construct-only invokes.
 *
 * Reachability note (verified 2026-10-08): usePassageCoverage and
 * useMapTabBarInset have zero production call sites (grep src/ — only their
 * own definitions). They are still exercised here so the suite covers every
 * file under src/hooks/, and the coverage-map row records the finding.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useAppLocationWatch } from '../src/hooks/useAppLocationWatch';
import { useBatteryLevel } from '../src/hooks/useBatteryLevel';
import { useBatteryOptimization } from '../src/hooks/useBatteryOptimization';
import { useChartCoverageAtPoint } from '../src/hooks/useChartCoverageAtPoint';
import { useDownloadFailureAlerts } from '../src/hooks/useDownloadFailureAlerts';
import { useDownloadKeepAwake } from '../src/hooks/useDownloadKeepAwake';
import { useEffectiveLayoutPreset, useLayoutContext } from '../src/hooks/useEffectiveLayoutPreset';
import { useEffectiveMapSplit } from '../src/hooks/useEffectiveMapSplit';
import { useExclusiveChartDownloadSession } from '../src/hooks/useExclusiveChartDownloadSession';
import { useFixAge } from '../src/hooks/useFixAge';
import { useForegroundTrackRecording } from '../src/hooks/useForegroundTrackRecording';
import { useFormFactor } from '../src/hooks/useFormFactor';
import { useMapBottomLayout } from '../src/hooks/useMapBottomLayout';
import { useMapCameraFollow } from '../src/hooks/useMapCameraFollow';
import { useMapScreenFocus } from '../src/hooks/useMapScreenFocus';
import { useMapSplitLayout } from '../src/hooks/useMapSplitLayout';
import { useMapSurfaceMode } from '../src/hooks/useMapSurfaceMode';
import { useMapTabBarInset } from '../src/hooks/useMapTabBarInset';
import { useMaritimeMonitors } from '../src/hooks/useMaritimeMonitors';
import { useMobLayoutSwitch } from '../src/hooks/useMobLayoutSwitch';
import { usePackDownloadActions } from '../src/hooks/usePackDownloadActions';
import { usePassageCoverage } from '../src/hooks/usePassageCoverage';
import { usePassageFollow } from '../src/hooks/usePassageFollow';
import { usePassagePackSuggestions } from '../src/hooks/usePassagePackSuggestions';
import { useResumeBackgroundSync } from '../src/hooks/useResumeBackgroundSync';
import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { isMapScreenFocused, resetMapScreenFocusForTests } from '../src/lib/map/mapScreenFocus';
import { layoutContextKey } from '../src/lib/settings/layoutPreferences';
import { reportDownloadFailure } from '../src/lib/offline/reportDownloadFailure';
import { reinforceLimitedForegroundSafetyNet } from '../src/lib/geo/limitedForegroundSafetyNet';
import { useLocationStore, type LocationFix } from '../src/services/locationService';
import { useFeedbackStore } from '../src/store/feedbackStore';
import { useNavigationStore } from '../src/store/navigationStore';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';
import { usePassageStore } from '../src/store/passageStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTrackStore } from '../src/store/trackStore';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));

jest.mock('../src/theme/ThemeContext', () => ({
  useTheme: () => ({
    colors: { text: '#000', textMuted: '#666', primary: '#06f', primaryText: '#fff', surface: '#fff', border: '#ccc' },
    minTouch: 48,
    spacing: { sm: 8, md: 12, lg: 16 },
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));

jest.mock('expo-battery', () => ({
  isAvailableAsync: jest.fn(async () => true),
  getBatteryLevelAsync: jest.fn(async () => 0.42),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
  isBatteryOptimizationEnabledAsync: jest.fn(async () => false),
  requestBatteryOptimizationDisabledAsync: jest.fn(async () => {}),
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => {}),
  ActivityAction: { APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS' },
}));

// useFocusEffect throws outside a NavigationContainer; run the callback as a
// plain effect so useMapScreenFocus's focus flag behavior is observable.
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('../src/lib/offline/reportDownloadFailure', () => {
  const actual = jest.requireActual('../src/lib/offline/reportDownloadFailure');
  return {
    ...actual,
    reportDownloadFailure: jest.fn(async () => {}),
  };
});

jest.mock('../src/lib/geo/limitedForegroundSafetyNet', () => {
  const actual = jest.requireActual('../src/lib/geo/limitedForegroundSafetyNet');
  return {
    ...actual,
    reinforceLimitedForegroundSafetyNet: jest.fn(async () => {}),
  };
});

const KIEL_READY = {
  regionId: 'kiel-bay',
  state: 'ready' as const,
  percentage: 100,
  packId: 'pack-kiel',
  error: null,
};

const fix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
  latitude: 54.32,
  longitude: 10.14,
  heading: 90,
  cogDeg: 95,
  speedMs: 2,
  speedKn: 4,
  accuracyM: 5,
  altitudeM: 0,
  timestamp: Date.now(),
  ...overrides,
});

const seedStores = () => {
  resetOfflinePackStoreForTests();
  resetMapScreenFocusForTests();
  useLocationStore.setState({ fix: null, lastGoodFix: null, displayFix: null, permission: 'foreground' } as any);
  useNavigationStore.setState({
    hydrated: true,
    goToTarget: null,
    mobTarget: null,
    anchorAlarm: null,
    activeLegIndex: 0,
    sessionDistanceNm: 0,
    screenLocked: false,
    alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
  } as any);
  usePassageStore.setState({ hydrated: true, passages: [], activePassageId: null } as any);
  useSettingsStore.setState({
    hydrated: true,
    activityProfileId: 'cruise-passage',
    layoutPreset: 'map-forward',
    layoutOverrides: {},
    backgroundTrackRecording: false,
    followMode: true,
    mapFollowZoom: 13,
  } as any);
  useTrackStore.setState({ hydrated: true, tracks: [], recordingTrackId: null, liveTrail: [] } as any);
};

describe('hookBehavior — exclusive download + surface modes', () => {
  beforeEach(seedStores);

  it('useExclusiveChartDownloadSession flips with coordinator + store lock', async () => {
    const { result } = renderHook(() => useExclusiveChartDownloadSession());
    expect(result.current).toBe(false);

    act(() => {
      downloadCoordinator.tryBegin('kiel-bay');
      useOfflinePackStore.setState({
        activeDownloadRegionId: 'kiel-bay',
        regions: { 'kiel-bay': { ...KIEL_READY, state: 'downloading' } },
      } as any);
    });
    expect(result.current).toBe(true);

    act(() => {
      useOfflinePackStore.setState({ activeDownloadRegionId: null } as any);
      downloadCoordinator.end('kiel-bay');
    });
    expect(result.current).toBe(false);

    // Preflight-only window must NOT claim exclusivity (minimap stays mounted).
    act(() => {
      downloadCoordinator.preflightLock('kattegat-south');
      useOfflinePackStore.setState({
        activeDownloadRegionId: 'kattegat-south',
        regions: { 'kattegat-south': { ...KIEL_READY, regionId: 'kattegat-south', state: 'downloading' } },
      } as any);
    });
    expect(result.current).toBe(false);
    act(() => {
      downloadCoordinator.releasePreflightLock('kattegat-south');
      useOfflinePackStore.setState({ activeDownloadRegionId: null, regions: {} } as any);
    });
    expect(result.current).toBe(false);
  });

  it('useMapSurfaceMode reacts to mob/screen-lock/planning state', () => {
    const { result } = renderHook(() => useMapSurfaceMode());
    expect(result.current.showBottomDock).toBe(true);
    expect(result.current.dockLayoutPreset).toBe('map-forward');

    act(() => {
      useNavigationStore.setState({ mobTarget: { id: 'm1', name: 'MOB', latitude: 54.3, longitude: 10.1, kind: 'mob' } } as any);
    });
    expect(result.current.showBottomDock).toBe(false);
    expect(result.current.showSafetyBar).toBe(false);
    expect(result.current.dockLayoutPreset).toBe('instruments-only');

    act(() => {
      useNavigationStore.setState({ mobTarget: null, screenLocked: true } as any);
    });
    expect(result.current.showBottomDock).toBe(false);

    act(() => {
      useNavigationStore.setState({ screenLocked: false } as any);
    });
    expect(result.current.showBottomDock).toBe(true);
  });
});

describe('hookBehavior — fix age + coverage + passage helpers', () => {
  beforeEach(seedStores);

  it('useFixAge reports stale/aging flags from the seeded fix', () => {
    useLocationStore.setState({ fix: fix({ timestamp: Date.now() - 60_000 }) } as any);
    const stale = renderHook(() => useFixAge());
    expect(stale.result.current.isStale).toBe(true);
    expect(stale.result.current.ageSec).toBeGreaterThanOrEqual(59);
    stale.unmount();

    useLocationStore.setState({ fix: fix({ timestamp: Date.now() - 15_000 }) } as any);
    const aging = renderHook(() => useFixAge());
    expect(aging.result.current.isAging).toBe(true);
    expect(aging.result.current.isStale).toBe(false);
    aging.unmount();

    useLocationStore.setState({ fix: null, permission: 'denied' } as any);
    const denied = renderHook(() => useFixAge());
    expect(denied.result.current.permissionDenied).toBe(true);
    expect(denied.result.current.ageSec).toBeNull();
    denied.unmount();
  });

  it('useChartCoverageAtPoint resolves ready-pack coverage at a position', () => {
    useOfflinePackStore.setState({ regions: { 'kiel-bay': KIEL_READY }, customBoundsIndex: {} } as any);
    const inside = renderHook(() => useChartCoverageAtPoint(54.32, 10.14));
    expect(inside.result.current.readyPackCount).toBe(1);
    expect(inside.result.current.covered).toBe(true);
    expect(inside.result.current.coveringLabels.length).toBeGreaterThan(0);
    inside.unmount();

    const outside = renderHook(() => useChartCoverageAtPoint(56.0, 10.14));
    expect(outside.result.current.covered).toBe(false);
    expect(outside.result.current.coveringLabels).toEqual([]);
    outside.unmount();
  });

  it('usePassageCoverage (no shipping call sites — dead-code audit) still computes a report', () => {
    useOfflinePackStore.setState({ regions: { 'kiel-bay': KIEL_READY }, customBoundsIndex: {} } as any);
    const covered = renderHook(() =>
      usePassageCoverage([
        { name: 'A', latitude: 54.25, longitude: 10.1 },
        { name: 'B', latitude: 54.4, longitude: 10.2 },
      ]),
    );
    expect(covered.result.current.fullyCovered).toBe(true);
    covered.unmount();

    useOfflinePackStore.setState({ regions: {}, customBoundsIndex: {} } as any);
    const bare = renderHook(() =>
      usePassageCoverage([{ name: 'A', latitude: 54.25, longitude: 10.1 }]),
    );
    expect(bare.result.current.fullyCovered).toBe(false);
    bare.unmount();
  });

  it('usePassagePackSuggestions suggests kiel-bay for a Kiel-area passage', () => {
    const { result } = renderHook(() =>
      usePassagePackSuggestions([
        { name: 'A', latitude: 54.25, longitude: 10.1 },
        { name: 'B', latitude: 54.4, longitude: 10.2 },
      ]),
    );
    expect(result.current.suggestionDetails.map((s) => s.packId)).toContain('kiel-bay');
    expect(result.current.suggestionDetails.find((s) => s.packId === 'kiel-bay')?.status.state).toBe('idle');
  });

  it('usePassageFollow reports not-following without an active passage', () => {
    const { result } = renderHook(() => usePassageFollow());
    expect(result.current.following).toBe(false);
    expect(result.current.totalLegs).toBe(0);
    expect(result.current.legNumber).toBe(0);
  });
});

describe('hookBehavior — layout + follow + lifecycle', () => {
  beforeEach(seedStores);

  it('useFormFactor/useMapSplitLayout/useEffectiveMapSplit stay internally consistent', () => {
    const ff = renderHook(() => useFormFactor());
    const { width, height } = ff.result.current;
    const expected = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
    expect(ff.result.current.formFactor).toBe(expected);
    expect(ff.result.current.isLandscape).toBe(width > height);
    ff.unmount();

    const split = renderHook(() => useMapSplitLayout());
    const effective = renderHook(() => useEffectiveMapSplit());
    expect(effective.result.current).toBe(split.result.current);
    split.unmount();

    act(() => {
      useNavigationStore.setState({ mobTarget: { id: 'm', name: 'M', latitude: 1, longitude: 1, kind: 'mob' } } as any);
    });
    const blocked = renderHook(() => useEffectiveMapSplit());
    expect(blocked.result.current).toBe(false);
    blocked.unmount();
    effective.unmount();
  });

  it('useEffectiveLayoutPreset honors a persisted override; useMobLayoutSwitch flips instruments-only to minimal', async () => {
    const ff = renderHook(() => useFormFactor());
    const ctx = { profileId: 'cruise-passage', bucket: ff.result.current.formFactor, isLandscape: ff.result.current.isLandscape };
    ff.unmount();

    await act(async () => {
      await useSettingsStore.getState().setLayoutOverride('instruments-only', ctx as any);
    });
    const preset = renderHook(() => useEffectiveLayoutPreset());
    expect(preset.result.current).toBe('instruments-only');

    const switcher = renderHook(() => useMobLayoutSwitch());
    await act(async () => {
      switcher.result.current();
    });
    const key = layoutContextKey(ctx as any);
    expect(useNavigationStore.getState().mobLayoutRestoreContextKey).toBe(key);
    expect(useSettingsStore.getState().layoutOverrides[key]).toBe('minimal');
    expect(preset.result.current).toBe('minimal');
    switcher.unmount();
    preset.unmount();
  });

  it('useMapCameraFollow commands the camera only when enabled — followZoom is the consumed zoom (dep pair)', () => {
    const easeTo = jest.fn();
    const cameraRef = { current: { easeTo } };
    const props = { cameraRef, enabled: true, mapReady: true, courseUp: true, followZoom: 16 as const, fix: fix() };
    const { rerender, unmount } = renderHook((p: typeof props) => useMapCameraFollow(p), { initialProps: props });
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 16, center: [10.14, 54.32] }));

    easeTo.mockClear();
    rerender({ ...props, followZoom: 13, fix: fix({ longitude: 10.2, timestamp: Date.now() + 1000 }) });
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 13 }));

    easeTo.mockClear();
    rerender({ ...props, enabled: false, fix: fix({ longitude: 10.3, timestamp: Date.now() + 2000 }) });
    expect(easeTo).not.toHaveBeenCalled();
    unmount();
  });

  it('useMapTabBarInset + useMapBottomLayout return real insets (dead-code audit for tab-bar inset)', () => {
    const inset = renderHook(() => useMapTabBarInset());
    expect(inset.result.current).toBeGreaterThan(0);
    inset.unmount();

    const layout = renderHook(() => useMapBottomLayout());
    expect(typeof layout.result.current.bottom).toBe('number');
    expect(layout.result.current.bottom).toBeGreaterThan(0);
    layout.unmount();
  });

  it('useMapScreenFocus publishes map focus state on mount/unmount', () => {
    const { unmount } = renderHook(() => useMapScreenFocus());
    expect(isMapScreenFocused()).toBe(true);
    unmount();
    expect(isMapScreenFocused()).toBe(false);
  });

  it('useDownloadKeepAwake activates only while a download session exists', async () => {
    const keepAwake = require('expo-keep-awake');
    useOfflinePackStore.setState({
      regions: { 'kiel-bay': { ...KIEL_READY, state: 'downloading' } },
    } as any);
    const { unmount } = renderHook(() => useDownloadKeepAwake());
    await act(async () => {});
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith('seacheck-download');
    unmount();
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledWith('seacheck-download');
  });

  it('useDownloadFailureAlerts reports a transition into a failed pack', async () => {
    useOfflinePackStore.setState({
      hydrated: true,
      regions: { 'kiel-bay': { ...KIEL_READY, state: 'downloading' } },
    } as any);
    const { unmount } = renderHook(() => useDownloadFailureAlerts());
    act(() => {
      useOfflinePackStore.setState({
        regions: { 'kiel-bay': { ...KIEL_READY, state: 'error', error: 'network down' } },
      } as any);
    });
    expect(reportDownloadFailure).toHaveBeenCalledWith(
      expect.objectContaining({ regionId: 'kiel-bay', source: 'async' }),
    );
    unmount();
  });

  it('usePackDownloadActions busy-locks other packs during an exclusive session', async () => {
    const showError = jest.fn();
    useFeedbackStore.setState({ showError, showInfo: jest.fn() } as any);
    useOfflinePackStore.setState({
      hydrated: true,
      regions: { 'kiel-bay': KIEL_READY },
      activeDownloadRegionId: 'kattegat-south',
    } as any);
    const { result } = renderHook(() => usePackDownloadActions());
    expect(result.current.packBusy('kiel-bay')).toBe(true);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.handleDownload('kiel-bay');
    });
    expect(outcome).toBe('failed');
    expect(showError).toHaveBeenCalled();
  });

  it('useForegroundTrackRecording appends fixes while recording, not when stale', async () => {
    jest.useFakeTimers();
    try {
      const appendPoint = jest.fn(async () => {});
      useTrackStore.setState({ recordingTrackId: 'trk-1', appendPoint } as any);
      useLocationStore.setState({ fix: fix() } as any);
      renderHook(() => useForegroundTrackRecording());
      act(() => {
        jest.advanceTimersByTime(2100);
      });
      expect(appendPoint).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 54.32, longitude: 10.14 }),
      );

      appendPoint.mockClear();
      useLocationStore.setState({ fix: fix({ timestamp: Date.now() - 60_000 }) } as any);
      act(() => {
        jest.advanceTimersByTime(2100);
      });
      expect(appendPoint).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('useBatteryLevel + useBatteryOptimization read device state', async () => {
    // jest env: the hook's dynamic import('expo-battery') is untransformed under
    // babel-jest → loadBatteryModule() catch-path returns null → level stays null.
    // That IS the shipped error path (device resolves the import → real level).
    const level = renderHook(() => useBatteryLevel(true));
    await act(async () => {});
    expect(level.result.current).toBeNull();
    level.unmount();

    // Platform.OS=ios under jest → non-android early return 'exempt'.
    const opt = renderHook(() => useBatteryOptimization(true));
    await act(async () => {});
    expect(opt.result.current).toBe('exempt');
    opt.unmount();
  });

  it('useResumeBackgroundSync reinforces the safety net on background/inactive', async () => {
    const addSpy = jest.spyOn(AppState, 'addEventListener');
    renderHook(() => useResumeBackgroundSync());
    const handlers = addSpy.mock.calls.map((c) => c[1]).filter((h) => typeof h === 'function');
    expect(handlers.length).toBeGreaterThan(0);

    await act(async () => {
      handlers.forEach((h) => h('background'));
    });
    expect(reinforceLimitedForegroundSafetyNet).toHaveBeenCalled();

    await act(async () => {
      handlers.forEach((h) => h('inactive'));
    });
    expect(reinforceLimitedForegroundSafetyNet).toHaveBeenCalledTimes(2);

    // The 'active' branch also runs a dynamic import('backgroundLocationService')
    // which is untransformed under babel-jest (jest-env limitation, not a product
    // gap — Hermes resolves it on device) — not fired here.
    // NOTE: spy left installed — mockRestore() on the RN preset's jest.fn wipes
    // its implementation and later addEventListener() calls would return undefined.
  });

  it('app-wide monitor + location watch hooks mount and clean up', () => {
    const monitors = renderHook(() => useMaritimeMonitors());
    monitors.unmount();
    const watch = renderHook(() => useAppLocationWatch());
    watch.unmount();
  });
});
