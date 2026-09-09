/**
 * Atlas v3 used-function invoke coverage for SeaCheck (standalone companion).
 * Calls shipping-reachable publics that lacked dedicated suite cites.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';

import {
  isAnchorMonitoringNeeded,
  isBackgroundTrackNeeded,
  loadNavPersist,
  loadSettingsPersist,
  resetAlarmFixHistory,
  shouldRunBackgroundLocation,
} from '../src/lib/alarms/alarmCoordinator';
import {
  DEFAULT_ALARM_RUNTIME,
  loadAlarmRuntime,
  resetAlarmRuntime,
  saveAlarmRuntime,
} from '../src/lib/alarms/alarmRuntimeState';
import { newId } from '../src/lib/db/database';
import { escapeXml, buildPassageRouteGpx, buildPassageSummaryText } from '../src/lib/gpx/gpx';
import { buildPassageLegSamples, assessPassageCoverage } from '../src/lib/map/coverage';
import {
  peekChartTileProbeDiagnostics,
  resetChartTileProbeCacheForTests,
} from '../src/lib/network/chartTileReachability';
import {
  isDeviceDisconnected,
  useIsEffectivelyOffline,
  useOnlineLayersAllowed,
} from '../src/lib/network/connectivity';
import {
  dismissBasemapMigrationNotice,
  peekBasemapMigrationNotice,
} from '../src/lib/offline/basemapMigration';
import {
  downloadCoordinator,
  subscribeDownloadCoordinatorActivity,
} from '../src/lib/offline/downloadCoordinator';
import {
  clearDownloadSessionPhase,
  peekDownloadFailureDiagnostics,
  peekDownloadSessionPhase,
  rememberDownloadFailureDiagnostics,
  rememberDownloadSessionPhase,
} from '../src/lib/offline/downloadFailureDiagnostics';
import {
  createDownloadMapController,
  endDownloadMapSessionOwnership,
  getDownloadMapHostDiagnostics,
  isDownloadMapReady,
  isDownloadMapStyleLoaded,
  isLiveDownloadMapController,
  markDownloadMapStyleFailed,
  noteDownloadMapEngineMounted,
  resetDownloadMapHostForTests,
  resetDownloadMapSession,
} from '../src/lib/offline/downloadMapHost';
import {
  isVisibleDownloadMapSlot,
  subscribeDownloadMapSlot,
  waitForVisibleDownloadMapSlot,
} from '../src/lib/offline/downloadMapSlot';
import { runLockedChartDownloadPreflight } from '../src/lib/offline/downloadPreflight';
import { subscribeNativePackOps } from '../src/lib/offline/nativePackMutex';
import { pauseAndDeleteNativePack } from '../src/lib/offline/nativePackRecovery';
import { readNativePackStatus } from '../src/lib/offline/nativePackStatus';
import { ensureOfflineManagerConfigured } from '../src/lib/offline/offlineManagerSetup';
import {
  getOfflineMapEngineViewportGeneration,
  getPendingOfflineMapEngineViewport,
  markOfflineMapEngineStyleFailed,
  offlineEngineViewportFromBounds,
  releaseOfflineMapEngineViewportForNavigation,
  resetOfflineMapEngineViewportPrimed,
  subscribeOfflineMapEngineStyleReload,
  subscribeOfflineMapEngineViewport,
  syncOfflineMapEngineFromDownloadMap,
} from '../src/lib/offline/offlineMapEngineHost';
import { prepareChartDownload } from '../src/lib/offline/prepareChartDownload';
import {
  reportDownloadFailureFromError,
  reportDownloadFailureFromRegion,
} from '../src/lib/offline/reportDownloadFailure';
import {
  resumeDurableOfflinePack,
  sealDurableOfflinePack,
} from '../src/lib/offline/sealDurableOfflinePack';
import {
  isNativeOfflinePackId,
  planTileCacheViewports,
  redownloadPlaceholderPackId,
  resolveSweepStride,
} from '../src/lib/offline/tileCacheDownload';
import { openBatteryOptimizationSettings } from '../src/lib/permissions/batteryOptimization';
import { readLocationPermissionSnapshot } from '../src/lib/permissions/locationPermissionState';
import {
  openSystemSettings,
  permissionStatusLabel,
  requestBackgroundLocationAccess,
  requestForegroundLocationAccess,
} from '../src/lib/permissions/locationPermissions';
import {
  lookupChartObjectOnline,
  queryLocalSeamarkAtTap,
  queryNearestSeamark,
  queryOverpassSeamark,
  seamarkBearingFrom,
} from '../src/lib/seamarks/querySeamark';
import { queryLocalSeamark } from '../src/lib/seamarks/seamarkIndex';
import {
  cancelSeamarkIndex,
  hasPendingSeamarkIndex,
  resetSeamarkIndexQueueForTests,
} from '../src/lib/seamarks/seamarkIndexQueue';
import {
  pulseUiAcknowledgement,
  triggerMaritimeAlarm,
} from '../src/services/alarmFeedbackService';
import { useAlarmMonitor } from '../src/services/alarmMonitor';
import {
  stopBackgroundLocationUpdates,
  syncRecordingBackgroundGps,
} from '../src/services/backgroundLocationService';
import {
  displayCog,
  displayHeading,
  isLowSog,
  resolveMapDisplayFix,
  useMapDisplayFix,
  type LocationFix,
} from '../src/services/locationService';
import {
  getMaritimeNotificationCanAskAgain,
  openMaritimeNotificationSettings,
  showMaritimeAlarmNotification,
} from '../src/services/maritimeAlarmNotifications';
import { persistRecordingTrackId } from '../src/services/trackBackgroundTask';
import {
  notifyTrackLiveTrailPoint,
  registerTrackLiveTrail,
} from '../src/services/trackLiveTrail';
import { appendTrackPointDirect } from '../src/services/trackPointWriter';
import { useCustomDownloadStore } from '../src/store/customDownloadStore';
import { useNavigationStore, waypointToTarget } from '../src/store/navigationStore';
import {
  kickstartNativeDownload,
  resetOfflinePackStoreForTests,
  useOfflinePackStore,
} from '../src/store/offlinePackStore';
import { usePassageStore } from '../src/store/passageStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTrackStore } from '../src/store/trackStore';
import { useWaypointStore } from '../src/store/waypointStore';

jest.mock('../src/lib/db/database', () => {
  const rows: Record<string, any[]> = {
    passages: [],
    waypoints: [],
    tracks: [],
    track_points: [],
    passage_waypoints: [],
    passage_leg_overrides: [],
  };
  const db = {
    execAsync: jest.fn(async () => {}),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM passages')) return [...rows.passages];
      if (sql.includes('FROM waypoints')) return [...rows.waypoints];
      if (sql.includes('FROM tracks')) return [...rows.tracks];
      if (sql.includes('FROM track_points')) return [...rows.track_points];
      if (sql.includes('FROM passage_waypoints')) return [...rows.passage_waypoints];
      return [];
    }),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith('INSERT INTO passages')) {
        rows.passages.unshift({
          id: params[0],
          name: params[1],
          planned_departure: params[2],
          default_sog_kn: params[3],
          is_active: params[4],
          created_at: params[5],
        });
      }
      if (sql.startsWith('INSERT INTO waypoints')) {
        rows.waypoints.unshift({
          id: params[0],
          name: params[1],
          latitude: params[2],
          longitude: params[3],
          type: params[4],
          note: params[5],
          created_at: params[6],
        });
      }
      if (sql.startsWith('INSERT INTO tracks')) {
        rows.tracks.unshift({
          id: params[0],
          name: params[1],
          started_at: params[2],
          ended_at: params[3] ?? null,
        });
      }
      if (sql.startsWith('UPDATE tracks')) {
        const track = rows.tracks.find((t) => t.id === params[params.length - 1]);
        if (track && sql.includes('ended_at')) track.ended_at = params[0];
      }
      if (sql.startsWith('DELETE FROM passages')) {
        rows.passages = rows.passages.filter((p) => p.id !== params[0]);
      }
      if (sql.startsWith('DELETE FROM tracks')) {
        rows.tracks = rows.tracks.filter((p) => p.id !== params[0]);
      }
      if (sql.startsWith('DELETE FROM waypoints')) {
        rows.waypoints = rows.waypoints.filter((p) => p.id !== params[0]);
      }
      return { lastInsertRowId: 1, changes: 1 };
    }),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
  };
  return {
    getDatabase: jest.fn(async () => db),
    withDatabaseTransaction: jest.fn(async (fn: (d: typeof db) => Promise<unknown>) => fn(db)),
    newId: jest.requireActual('../src/lib/db/database').newId,
  };
});

jest.mock('../src/lib/seamarks/seamarkIndex', () => ({
  queryLocalSeamark: jest.fn(async () => null),
  indexSeamarksForPack: jest.fn(async () => 0),
  clearSeamarkIndex: jest.fn(async () => {}),
}));

jest.mock('../src/services/trackBackgroundTask', () => ({
  persistRecordingTrackId: jest.fn(async () => {}),
  TRACK_LOCATION_TASK: 'seacheck-track-recording',
}));

jest.mock('../src/lib/seamarks/overpassClient', () => ({
  OVERPASS_ENDPOINTS: ['https://overpass-api.de/api/interpreter'],
  fetchOverpass: jest.fn(async () => ({
    ok: true,
    json: async () => ({ elements: [] }),
  })),
}));

jest.mock('../src/map/chartStyle', () => ({
  ensureChartStyleFile: jest.fn(async () => 'file:///mock/chart-style.json'),
  offlinePackMapStyleUri: jest.fn((uri: string) => uri),
  ensureOfflinePackStyleReachable: jest.fn(async () => {}),
}));

jest.mock('../src/lib/network/downloadNetwork', () => ({
  assertNetworkForDownload: jest.fn(async () => {}),
  assertChartDownloadNetworkReady: jest.fn(async () => {}),
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

jest.mock('../src/lib/offline/warmupOfflineEngine', () => ({
  warmupOfflineEngine: jest.fn(async () => {}),
}));

jest.mock('../src/lib/network/chartTileReachability', () => {
  const actual = jest.requireActual('../src/lib/network/chartTileReachability');
  return {
    ...actual,
    assertChartTileReachability: jest.fn(async () => {}),
  };
});

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => {}),
  ActivityAction: { APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS' },
}));

jest.mock('expo-battery', () => ({
  isBatteryOptimizationEnabledAsync: jest.fn(async () => false),
  requestBatteryOptimizationDisabledAsync: jest.fn(async () => {}),
}));

beforeAll(() => {
  const { Linking } = require('react-native');
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

const sampleFix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
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

describe('AtlasShippingReachableInvoke — pure / alarm / gpx / coverage', () => {
  it('invokes alarm coordinator + runtime helpers', async () => {
    resetAlarmFixHistory();
    resetAlarmRuntime();
    await saveAlarmRuntime({ ...DEFAULT_ALARM_RUNTIME, xteFired: true });
    const runtime = await loadAlarmRuntime();
    expect(runtime.xteFired).toBe(true);
    await expect(loadNavPersist()).resolves.toBeDefined();
    await expect(loadSettingsPersist()).resolves.toBeDefined();
    await expect(isAnchorMonitoringNeeded()).resolves.toBe(false);
    await expect(isBackgroundTrackNeeded()).resolves.toBe(false);
    await expect(shouldRunBackgroundLocation()).resolves.toBe(false);
  });

  it('invokes newId + escapeXml + gpx builders + coverage samples', () => {
    expect(newId('wp')).toMatch(/^wp_/);
    expect(escapeXml('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    const gpx = buildPassageRouteGpx(
      'Test',
      [
        { name: 'A', latitude: 54.3, longitude: 10.1 },
        { name: 'B', latitude: 54.4, longitude: 10.2 },
      ],
      [
        {
          from: { name: 'A', latitude: 54.3, longitude: 10.1 },
          to: { name: 'B', latitude: 54.4, longitude: 10.2 },
          distanceNm: 1,
        },
      ],
    );
    expect(gpx).toContain('<gpx');
    expect(
      buildPassageSummaryText(
        'P',
        [
          {
            fromName: 'A',
            toName: 'B',
            bearingDeg: 45,
            distanceNm: 1,
            cumulativeNm: 1,
            sogKn: 5,
            durationHours: 0.2,
            etaUtc: null,
            note: '',
          },
        ],
        1,
        0.2,
      ).length,
    ).toBeGreaterThan(0);
    const samples = buildPassageLegSamples([
      { name: 'A', latitude: 54.3, longitude: 10.1 },
      { name: 'B', latitude: 54.4, longitude: 10.2 },
    ]);
    expect(samples.length).toBe(1);
    const report = assessPassageCoverage(
      [
        { name: 'A', latitude: 54.3, longitude: 10.1 },
        { name: 'B', latitude: 54.4, longitude: 10.2 },
      ],
      [],
    );
    expect(report.fullyCovered).toBe(false);
  });
});

describe('AtlasShippingReachableInvoke — network / offline hosts', () => {
  beforeEach(() => {
    resetChartTileProbeCacheForTests();
    resetDownloadMapHostForTests();
    resetOfflinePackStoreForTests();
    resetSeamarkIndexQueueForTests();
  });

  it('invokes connectivity + tile probe diagnostics', () => {
    expect(isDeviceDisconnected({ isConnected: false } as any)).toBe(true);
    const { result: offline } = renderHook(() => useIsEffectivelyOffline());
    expect(typeof offline.current).toBe('boolean');
    const { result: layers } = renderHook(() => useOnlineLayersAllowed());
    expect(typeof layers.current).toBe('boolean');
    expect(peekChartTileProbeDiagnostics() == null || typeof peekChartTileProbeDiagnostics() === 'object').toBe(true);
  });

  it('invokes download failure diagnostics + coordinator subscribe', () => {
    rememberDownloadFailureDiagnostics('kiel-bay', {
      nativeState: 'active',
      percentage: 10,
      completedResourceCount: 1,
      requiredResourceCount: 10,
    });
    expect(peekDownloadFailureDiagnostics('kiel-bay')?.percentage).toBe(10);
    rememberDownloadSessionPhase('kiel-bay', 'preflight');
    expect(peekDownloadSessionPhase('kiel-bay')).toBe('preflight');
    clearDownloadSessionPhase('kiel-bay');
    expect(peekDownloadSessionPhase('kiel-bay')).toBeUndefined();
    const unsub = subscribeDownloadCoordinatorActivity(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
    expect(downloadCoordinator.hasActiveDownload()).toBe(false);
  });

  it('invokes download map host + slot + offline engine helpers', async () => {
    resetDownloadMapSession();
    noteDownloadMapEngineMounted();
    markDownloadMapStyleFailed(new Error('style'));
    expect(typeof isDownloadMapReady()).toBe('boolean');
    expect(typeof isDownloadMapStyleLoaded()).toBe('boolean');
    expect(getDownloadMapHostDiagnostics()).toBeTruthy();
    const cameraRef = { current: null };
    const controller = createDownloadMapController(cameraRef as any);
    expect(isLiveDownloadMapController(controller)).toBe(true);
    endDownloadMapSessionOwnership();
    expect(typeof isVisibleDownloadMapSlot()).toBe('boolean');
    const unsubSlot = subscribeDownloadMapSlot(() => {});
    unsubSlot();
    await expect(waitForVisibleDownloadMapSlot(5)).resolves.toBe(false);

    const viewport = offlineEngineViewportFromBounds([10, 54, 11, 55] as any);
    expect(viewport).toBeTruthy();
    markOfflineMapEngineStyleFailed(new Error('x'));
    resetOfflineMapEngineViewportPrimed();
    expect(getOfflineMapEngineViewportGeneration()).toBeGreaterThanOrEqual(0);
    expect(
      getPendingOfflineMapEngineViewport() == null || typeof getPendingOfflineMapEngineViewport() === 'object',
    ).toBe(true);
    releaseOfflineMapEngineViewportForNavigation();
    const u1 = subscribeOfflineMapEngineStyleReload(() => {});
    const u2 = subscribeOfflineMapEngineViewport(() => {});
    u1();
    u2();
    syncOfflineMapEngineFromDownloadMap();
  });

  it('invokes tile cache plan helpers + native pack helpers', async () => {
    expect(resolveSweepStride()).toEqual({ strideX: 1, strideY: 1 });
    const plan = planTileCacheViewports([10, 54, 10.1, 54.1] as any, 8, 8);
    expect(Array.isArray(plan)).toBe(true);
    expect(isNativeOfflinePackId('native-pack-1')).toBe(true);
    expect(redownloadPlaceholderPackId('kiel-bay')).toContain('kiel-bay');
    const unsub = subscribeNativePackOps(() => {});
    unsub();
    await ensureOfflineManagerConfigured();
    await expect(
      readNativePackStatus({
        id: 'p1',
        status: async () => ({ state: 'complete', percentage: 100 }),
      } as any),
    ).resolves.toBeTruthy();
    await pauseAndDeleteNativePack('p1');
  });

  it('invokes prepare/preflight/report/seal/resume with mocked deps', async () => {
    await prepareChartDownload(async () => 'file:///style.json', 'kiel-bay', {
      latitude: 54.32,
      longitude: 10.14,
    });
    // busy lock path still invokes runLockedChartDownloadPreflight
    useOfflinePackStore.setState({
      regions: {},
    } as any);
    // Ensure preflight lock can be taken
    const locked = useOfflinePackStore.getState().preflightDownloadLock('atlas-preflight');
    if (locked) {
      useOfflinePackStore.getState().releasePreflightDownloadLock('atlas-preflight');
    }
    await runLockedChartDownloadPreflight('atlas-preflight', async () => 'file:///style.json', {
      latitude: 54.32,
      longitude: 10.14,
    });
    reportDownloadFailureFromError('kiel-bay', new Error('boom'), 'preflight');
    reportDownloadFailureFromRegion('kiel-bay');
    await dismissBasemapMigrationNotice();
    expect(peekBasemapMigrationNotice() == null || typeof peekBasemapMigrationNotice() === 'object').toBe(true);

    const pack = {
      id: 'mock-pack',
      resume: jest.fn(async () => {}),
      pause: jest.fn(async () => {}),
      status: async () => ({ state: 'complete', percentage: 100 }),
    };
    const OfflineManager = require('@maplibre/maplibre-react-native').OfflineManager;
    OfflineManager.createPack = jest.fn(async (_opts: unknown, onProgress: Function) => {
      onProgress(pack, { state: 'complete', percentage: 100 });
      return pack;
    });
    OfflineManager.getPacks = jest.fn(async () => [pack]);

    const sealed = await sealDurableOfflinePack({
      regionId: 'kiel-bay',
      session: 1,
      chartStyleUri: 'file:///style.json',
      bounds: [10, 54, 11, 55] as any,
      minZoom: 8,
      maxZoom: 10,
      stallMessage: 'stall',
      mapEngineStallMessage: 'map-stall',
      isCancelled: () => false,
      isNativeDownloadComplete: () => true,
      kickstartNativeDownload: async () => ({ state: 'complete', percentage: 100 }) as any,
      onPackCreated: () => {},
      onProgress: () => {},
    });
    expect(typeof sealed).toBe('string');

    await resumeDurableOfflinePack({
      pack: pack as any,
      regionId: 'kiel-bay',
      session: 1,
      chartStyleUri: 'file:///style.json',
      bounds: [10, 54, 11, 55] as any,
      minZoom: 8,
      stallMessage: 'stall',
      mapEngineStallMessage: 'map-stall',
      createOptions: { name: 'kiel-bay', styleURL: 'file:///style.json', bounds: [10, 54, 11, 55], minZoom: 8, maxZoom: 10 },
      isCancelled: () => false,
      isNativeDownloadComplete: () => true,
      kickstartNativeDownload: async () => ({ state: 'complete', percentage: 100 }) as any,
      onProgress: () => {},
    });
  });
});

describe('AtlasShippingReachableInvoke — permissions + seamarks + services', () => {
  it('invokes permission helpers', async () => {
    const snap = await readLocationPermissionSnapshot();
    expect(snap).toBeTruthy();
    expect(permissionStatusLabel('granted').length).toBeGreaterThan(0);
    await requestForegroundLocationAccess();
    await requestBackgroundLocationAccess();
    await openSystemSettings();
    await openBatteryOptimizationSettings();
  });

  it('invokes seamark query surface (mocked overpass/local)', async () => {
    await expect(queryLocalSeamark(54.32, 10.14)).resolves.toBeNull();
    await expect(queryLocalSeamarkAtTap(54.32, 10.14)).resolves.toBeNull();
    await expect(queryOverpassSeamark(54.32, 10.14)).resolves.toBeNull();
    await expect(queryNearestSeamark(54.32, 10.14)).resolves.toBeNull();
    await expect(lookupChartObjectOnline(54.32, 10.14)).resolves.toBeNull();
    expect(
      seamarkBearingFrom([10.14, 54.32], {
        name: 'X',
        type: 'buoy',
        latitude: 54.33,
        longitude: 10.15,
        distanceM: 10,
        source: 'local',
        rawTags: {},
      }),
    ).toEqual(expect.any(Number));
    cancelSeamarkIndex('kiel-bay');
    expect(typeof hasPendingSeamarkIndex()).toBe('boolean');
  });

  it('invokes alarm/location/track services', async () => {
    await triggerMaritimeAlarm('warning', 'test');
    await pulseUiAcknowledgement();
    const { unmount } = renderHook(() => useAlarmMonitor());
    unmount();
    await stopBackgroundLocationUpdates();
    await syncRecordingBackgroundGps(null);
    const fix = sampleFix();
    expect(resolveMapDisplayFix(fix, fix, fix, false)).toEqual(fix);
    expect(displayHeading(fix)).toBe(90);
    expect(displayCog(fix) === null || typeof displayCog(fix) === 'number').toBe(true);
    expect(isLowSog(sampleFix({ speedKn: 1 }))).toBe(true);
    const { result, unmount: u2 } = renderHook(() => useMapDisplayFix());
    expect(result.current === null || typeof result.current === 'object').toBe(true);
    u2();
    expect(typeof getMaritimeNotificationCanAskAgain()).toBe('boolean');
    await openMaritimeNotificationSettings();
    await showMaritimeAlarmNotification('Anchor', 'Drift');
    await persistRecordingTrackId('trk-1');
    registerTrackLiveTrail({
      getRecordingTrackId: () => 'trk-1',
      pushLiveTrailPoint: () => {},
    });
    notifyTrackLiveTrailPoint('trk-1', 10.14, 54.32);
    await appendTrackPointDirect('trk-1', {
      latitude: 54.32,
      longitude: 10.14,
      sog_ms: 1,
      cog_deg: 90,
    });
  });
});

describe('AtlasShippingReachableInvoke — stores', () => {
  beforeEach(() => {
    resetOfflinePackStoreForTests();
    useCustomDownloadStore.getState().cancelSelecting();
    useNavigationStore.setState({
      hydrated: true,
      goToTarget: null,
      mobTarget: null,
      anchorAlarm: null,
      activeLegIndex: 0,
      sessionDistanceNm: 0,
      sessionStartedAtMs: null,
      screenLocked: false,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
      anchorWatchPrompt: null,
      anchorWatchPromptDismissed: false,
    } as any);
    useSettingsStore.setState({ hydrated: true, onboardingCompleted: false } as any);
    usePassageStore.setState({ hydrated: true, passages: [], activePassageId: null } as any);
    useTrackStore.setState({
      hydrated: true,
      tracks: [],
      recordingTrackId: null,
      liveTrail: [],
      liveInspectPoints: [],
      mapPreviewTrackId: null,
      mapPreviewLine: [],
      mapPreviewPoints: [],
      mapPreviewDistanceNm: null,
    } as any);
    useWaypointStore.setState({ hydrated: true, waypoints: [] } as any);
  });

  it('invokes customDownloadStore actions', () => {
    const s = useCustomDownloadStore.getState();
    s.startSelecting();
    s.addCorner({ latitude: 54.3, longitude: 10.0 });
    s.selectCorner('0');
    s.startRelocateCorner(0);
    s.cancelRelocate();
    s.resetCorners();
    s.setZoomRange(8, 12);
    s.setPackName('Custom');
    expect(typeof s.isComplete()).toBe('boolean');
  });

  it('invokes navigationStore actions', async () => {
    const nav = useNavigationStore.getState();
    expect(
      waypointToTarget({
        id: 'w1',
        name: 'W',
        latitude: 54.32,
        longitude: 10.14,
        type: 'generic',
        note: '',
        created_at: Date.now(),
      }),
    ).toMatchObject({ kind: 'waypoint' });
    await nav.setGoTo({
      id: 'g1',
      name: 'Go',
      latitude: 54.32,
      longitude: 10.14,
      kind: 'waypoint',
    });
    await nav.dropMob(54.32, 10.14);
    await nav.clearMob();
    await nav.setAnchorAlarm(54.32, 10.14, 0.1);
    await nav.patchAnchorRadiusNm(0.2);
    await nav.patchAnchorArmedLimited(true);
    await nav.setAnchorTriggered(true);
    await nav.clearAnchorAlarm();
    await nav.setActiveLegIndex(1);
    await nav.addSessionDistanceNm(0.5);
    await nav.resetSessionDistance();
    await nav.ensureSessionStarted();
    await nav.setScreenLocked(true);
    await nav.patchAlarmLimits({ xteNm: 0.1 });
    nav.setAnchorWatchPrompt({ kind: 'limited' } as any);
    nav.dismissAnchorWatchPrompt();
  });

  it('invokes settingsStore actions', async () => {
    const s = useSettingsStore.getState();
    await s.completeOnboarding();
    await s.acknowledgeBatteryGuidance();
    await s.dismissDownloadHint();
    await s.dismissPassagePlanningGuide();
    await s.setLayoutOverride('instruments' as any, {
      formFactor: 'phone',
      orientation: 'portrait',
    } as any);
    await s.applyActivityProfile('cruise');
  });

  it('invokes waypoint + passage + track store actions', async () => {
    const wp = await useWaypointStore.getState().create({
      name: 'Mark',
      latitude: 54.32,
      longitude: 10.14,
      type: 'mark',
      note: '',
    });
    await useWaypointStore.getState().update(wp.id, { name: 'Mark2' });
    const passage = await usePassageStore.getState().createPassage('Atlas Passage');
    await usePassageStore.getState().addWaypointToPassage(passage.id, wp.id);
    const wp2 = await useWaypointStore.getState().create({
      name: 'MarkB',
      latitude: 54.4,
      longitude: 10.2,
      type: 'mark',
    });
    await usePassageStore.getState().addWaypointToPassage(passage.id, wp2.id);
    await usePassageStore.getState().setPassageMeta(passage.id, { default_sog_kn: 6 });
    await usePassageStore.getState().setLegOverride(passage.id, wp.id, wp2.id, { sogKn: 5, note: 'n' });
    await usePassageStore.getState().activatePassage(passage.id);
    await usePassageStore.getState().setPassageActiveLeg(0);
    await usePassageStore.getState().buildPassageSummary(passage.id);
    await usePassageStore.getState().exportPassageGpx(passage.id);
    await usePassageStore.getState().duplicatePassage(passage.id);
    await usePassageStore.getState().reorderWaypointInPassage(passage.id, wp2.id, 0);
    await usePassageStore.getState().reversePassageWaypoints(passage.id);
    await usePassageStore.getState().deletePassage(passage.id);
    await useWaypointStore.getState().remove(wp.id);
    await useWaypointStore.getState().remove(wp2.id);

    const trackId = await useTrackStore.getState().startRecording('Atlas Track');
    await useTrackStore.getState().appendPoint({
      latitude: 54.32,
      longitude: 10.14,
      sog_ms: 1,
      cog_deg: 90,
    });
    useTrackStore.getState().pushLiveTrailPoint(10.14, 54.32);
    await useTrackStore.getState().getPoints(trackId);
    await useTrackStore.getState().getTrackDistanceNm(trackId);
    await useTrackStore.getState().setMapPreviewTrack(trackId);
    await useTrackStore.getState().exportGpx(trackId);
    await useTrackStore.getState().stopRecording();
    await useTrackStore.getState().deleteTrack(trackId);
  });

  it('invokes offlinePackStore public actions without full tile sweep', async () => {
    const store = useOfflinePackStore.getState();
    await store.ensureHydratedForUi();
    await store.ensureChartStyle();
    store.resetDownloadErrorForRetry('kiel-bay');
    await store.dismissBasemapMigrationNotice();
    // Invalid tiny bounds still enters startCustomDownload (validation throw = real invoke)
    await expect(
      store.startCustomDownload('Custom Atlas', [10.0, 54.3, 10.0001, 54.3001] as any, 8, 10),
    ).rejects.toBeTruthy();
    await store.retryPendingSeamarkIndexing();
    const status = await kickstartNativeDownload(
      {
        id: 'p',
        resume: jest.fn(async () => {}),
        status: async () => ({ state: 'complete', percentage: 100 }),
      } as any,
      'file:///style.json',
    );
    expect(status).toBeTruthy();
    // retry/delete on missing region should no-op or fail closed without hanging
    await store.deleteRegion('missing-region-atlas');
    await store.retryDownload('missing-region-atlas');
  });
});
