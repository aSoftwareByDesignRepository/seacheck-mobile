import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Camera,
  Map,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Device from 'expo-device';

import {
  getOfflineMapEngineViewportGeneration,
  getPendingOfflineMapEngineViewport,
  markOfflineMapEngineStyleFailed,
  markOfflineMapEngineStyleLoaded,
  markOfflineMapEngineViewportPrimed,
  subscribeOfflineMapEngineViewport,
} from '../../lib/offline/offlineMapEngineHost';
import { isMapScreenFocused } from '../../lib/map/mapScreenFocus';
import { useIsDeviceDisconnected } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
import { useMapCameraFollow } from '../../hooks/useMapCameraFollow';
import { CustomDownloadMapPanel } from '../downloads/CustomDownloadMapPanel';
import { CustomDownloadCornerSheet } from '../downloads/CustomDownloadCornerSheet';
import { nearestDownloadCorner, boundsFromPoints } from '../../lib/map/customDownloadCorners';
import { PassageMapPlanningPanel } from '../passage/PassageMapPlanningPanel';
import { PassageMapPlanningGuideBanner } from '../passage/PassageMapPlanningGuideBanner';
import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import {
  addMapWaypointToPassage,
  startNewPassageFromMap,
} from '../../lib/passage/passageMapPlanning';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import { ResponsiveMapShell } from '../responsive/ResponsiveMapShell';
import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { useEffectiveMapSplit } from '../../hooks/useEffectiveMapSplit';
import { useFormFactor } from '../../hooks/useFormFactor';
import { resolveMapSafetyChromePlacement } from '../../lib/map/mapScreenLayoutPolicy';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { useMobLayoutSwitch } from '../../hooks/useMobLayoutSwitch';
import { useMapSurfaceMode } from '../../hooks/useMapSurfaceMode';
import { configureMapLogging } from '../../map/mapLogging';
import { formatCoordinates } from '../../map/coords';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useLocationStore, isFixStale } from '../../services/locationService';
import { useCustomDownloadStore, type CornerMutationResult } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useConfirmStore } from '../../store/confirmStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore } from '../../store/passageStore';
import { useTrackStore } from '../../store/trackStore';
import { PLANNING_WAYPOINT_PICK_RADIUS_NM } from '../../lib/geo/nearestWaypoint';
import { mapChartHasOpenDetail, pickMapChartFeatures, resolveMapChartTapAction } from '../../lib/map/mapChartInteraction';
import { buildMapChartAccessibilityLabel } from '../../lib/map/mapAccessibility';
import { resolveBoatHeadingDeg } from '../../lib/geo/cog';
import { isValidCoordinate } from '../../lib/geo/fixQuality';
import { distanceNm } from '../../lib/geo/navigation';
import { mapTappableWaypoints } from '../../lib/map/mapVisibleWaypoints';
import { resolveMapInitialCenter, shouldPauseFollowOnRegionChange } from '../../lib/map/mapCameraFollow';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ActionSheet } from '../../ui/ActionSheet';
import { AnchorWatchLimitedSheet } from './AnchorWatchLimitedSheet';
import { ExpoLocationPuck } from './ExpoLocationPuck';
import { CourseVectorOverlay } from './CourseVectorOverlay';
import { MapBottomDock } from './MapBottomDock';
import { MapChrome } from './MapChrome';
import { MapInstrumentDock } from './MapInstrumentDock';
import { MapInstrumentPanel } from './MapInstrumentPanel';
import { InstrumentsOnlyShell } from './InstrumentsOnlyShell';
import { MapTopChrome } from './MapTopChrome';
import { MobNavigateBackOverlay } from './MobNavigateBackOverlay';
import { SeamarkDetailSheet } from './SeamarkDetailSheet';
import { TrackPointMapDetailSheet } from './TrackPointMapDetailSheet';
import { WaypointMapDetailSheet } from './WaypointMapDetailSheet';
import { MapOverlays } from './MapOverlays';
import { CustomDownloadOverlays } from './CustomDownloadOverlays';
import { mapChromeInsets } from './mapChromeInsets';
import { CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX, PASSAGE_PLANNING_PANEL_CONTENT_MAX } from './mapChromeLayout';
import { boundsFromLonLat, boundsFromWaypoints } from '../../lib/map/passageBounds';
import {
  lookupChartObjectOnline,
  queryLocalSeamarkAtTap,
  type SeamarkHit,
} from '../../lib/seamarks/querySeamark';
import type { TrackPointRow, WaypointRow } from '../../lib/db/database';

export function NavigationMap() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const chrome = mapChromeInsets(insets, spacing.lg);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const mapPreviewLine = useTrackStore((s) => s.mapPreviewLine);
  const mapPreviewTrackId = useTrackStore((s) => s.mapPreviewTrackId);
  const mapPreviewPoints = useTrackStore((s) => s.mapPreviewPoints);
  const liveInspectPoints = useTrackStore((s) => s.liveInspectPoints);
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);
  const tracks = useTrackStore((s) => s.tracks);
  const followMode = useSettingsStore((s) => s.followMode);
  const mapFollowZoom = useSettingsStore((s) => s.mapFollowZoom);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const exclusiveChartDownload = useExclusiveChartDownloadSession();
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const hydrateOffline = useOfflinePackStore((s) => s.hydrate);
  const offlineRegions = useOfflinePackStore((s) => s.regions);
  const hasReadyPack = selectHasReadyOfflinePack(offlineRegions);
  const savedWaypoints = useWaypointStore((s) => s.items);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const customCorners = useCustomDownloadStore((s) => s.corners);
  const customSelectedCornerId = useCustomDownloadStore((s) => s.selectedCornerId);
  const addCustomCorner = useCustomDownloadStore((s) => s.addCorner);
  const selectCustomCorner = useCustomDownloadStore((s) => s.selectCorner);
  const startRelocateCustomCorner = useCustomDownloadStore((s) => s.startRelocateCorner);
  const moveCustomCorner = useCustomDownloadStore((s) => s.moveCorner);
  const removeCustomCorner = useCustomDownloadStore((s) => s.removeCorner);
  const planningPassageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);
  const allowRouteEdits = usePassageMapPlanningStore((s) => s.allowRouteEdits);
  const passageMapPlanning = planningPassageId != null;
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const passages = usePassageStore((s) => s.passages);
  const [followActive, setFollowActive] = useState(followMode);
  const layoutPreset = useEffectiveLayoutPreset();
  const effectiveSplit = useEffectiveMapSplit();
  const { formFactor, isLandscape } = useFormFactor();
  const isMinimalLayout = layoutPreset === 'minimal';
  const isMapForwardLayout = layoutPreset === 'map-forward';
  const isInstrumentsOnlyLayout = layoutPreset === 'instruments-only';
  const showChartInInstrumentsOnly = customSelecting || passageMapPlanning || mobTarget != null;
  const switchLayoutOnMob = useMobLayoutSwitch();
  const surface = useMapSurfaceMode();
  const showRecenter =
    followMode && !followActive && !screenLocked && (!isInstrumentsOnlyLayout || showChartInInstrumentsOnly);
  /** Ashore / planning / download area pick — no lock, anchor, or MOB on the chart edge. */
  const showSideActions =
    !screenLocked && !mobTarget && !passageMapPlanning && !customSelecting;
  const safetyChromePlacement = resolveMapSafetyChromePlacement({
    showSideActions,
    effectiveSplit,
  });
  const mapBottom = useMapBottomLayout({ showSideActions });
  const instrumentsTopChromeLayout = useMapBottomLayout({ showSideActions });
  const [seamarkHit, setSeamarkHit] = useState<SeamarkHit | null>(null);
  const [waypointHit, setWaypointHit] = useState<WaypointRow | null>(null);
  const [trackPointHit, setTrackPointHit] = useState<TrackPointRow | null>(null);
  const [activePassageWaypoints, setActivePassageWaypoints] = useState<WaypointRow[]>([]);
  const [seamarkLoading, setSeamarkLoading] = useState(false);
  const initialMapCenter = useMemo(
    () => resolveMapInitialCenter(fix ?? lastGoodFix),
    [fix?.latitude, fix?.longitude, lastGoodFix?.latitude, lastGoodFix?.longitude],
  );
  const [mapCenter, setMapCenter] = useState(() => ({
    latitude: initialMapCenter[1],
    longitude: initialMapCenter[0],
  }));
  const [mapZoom, setMapZoom] = useState<number>(() => (followMode ? mapFollowZoom : 11));
  const [chartRetryBusy, setChartRetryBusy] = useState(false);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false);
  const pendingOfflineViewport = useSyncExternalStore(
    subscribeOfflineMapEngineViewport,
    getPendingOfflineMapEngineViewport,
    () => null,
  );
  const offlineViewportGeneration = useSyncExternalStore(
    subscribeOfflineMapEngineViewport,
    getOfflineMapEngineViewportGeneration,
    () => 0,
  );
  const reportNavigationChartReady = useCallback(() => {
    if (!chartStyleUri || !isMapScreenFocused()) return;
    markOfflineMapEngineStyleLoaded(chartStyleUri);
    const viewport = getPendingOfflineMapEngineViewport();
    if (viewport) {
      markOfflineMapEngineViewportPrimed(viewport, getOfflineMapEngineViewportGeneration());
    }
  }, [chartStyleUri]);
  const [longPressAction, setLongPressAction] = useState<{ lat: number; lon: number; coordLabel: string } | null>(null);
  const [planningSelectedWaypointId, setPlanningSelectedWaypointId] = useState<string | null>(null);
  const [planningOpenEditOnTap, setPlanningOpenEditOnTap] = useState(false);
  const suppressNextPressRef = useRef(false);
  const planningCameraFitRef = useRef<{ passageId: string; revision: number } | null>(null);
  const customCameraFitSigRef = useRef('');
  const addingPlanningWaypointRef = useRef(false);
  const isOffline = useIsDeviceDisconnected();
  const chartCoverage = useChartCoverageAtPoint(mapCenter.latitude, mapCenter.longitude);
  const showScaleBar = Platform.OS === 'ios' || Device.isDevice;
  const boatFix = fix ?? lastGoodFix;

  useEffect(() => {
    if (!activePassageId) {
      setActivePassageWaypoints([]);
      return;
    }
    void getPassageDetail(activePassageId).then((detail) => {
      setActivePassageWaypoints(detail?.waypoints ?? []);
    });
  }, [activePassageId, passages, getPassageDetail, planningRevision]);

  const mapTapWaypoints = useMemo(
    () => mapTappableWaypoints(savedWaypoints, activePassageWaypoints),
    [savedWaypoints, activePassageWaypoints],
  );

  const mapAccessibilityLabel = useMemo(
    () =>
      buildMapChartAccessibilityLabel({
        centerLatitude: mapCenter.latitude,
        centerLongitude: mapCenter.longitude,
        coordFormat,
        followMode,
        followActive,
        screenLocked,
        zoom: mapZoom,
        boatLatitude: boatFix?.latitude ?? null,
        boatLongitude: boatFix?.longitude ?? null,
        boatHeadingDeg: boatFix ? resolveBoatHeadingDeg(boatFix) : null,
        boatStale: isFixStale(fix),
        isOffline: offlineHydrated && isOffline,
        hasReadyPack,
        chartCovered: offlineHydrated && hasReadyPack ? chartCoverage.covered : undefined,
      }),
    [
      mapCenter.latitude,
      mapCenter.longitude,
      coordFormat,
      followMode,
      followActive,
      screenLocked,
      mapZoom,
      boatFix?.latitude,
      boatFix?.longitude,
      boatFix?.heading,
      boatFix?.cogDeg,
      boatFix?.speedKn,
      fix?.timestamp,
      isOffline,
      offlineHydrated,
      hasReadyPack,
      chartCoverage.covered,
    ],
  );

  useEffect(() => {
    configureMapLogging();
  }, []);

  useEffect(() => {
    if (customSelecting) {
      setFollowActive(false);
    }
  }, [customSelecting]);

  const reportCustomMutation = useCallback(
    (result: CornerMutationResult) => {
      if (result.kind === 'added') {
        if (result.complete) {
          showInfo(t('downloads.customRectangleComplete'));
        } else {
          showInfo(t('downloads.customCornerPlaced', { index: result.index }));
        }
      } else if (result.kind === 'moved') {
        showInfo(t('downloads.customCornerMoved', { index: result.index }));
      } else if (result.kind === 'removed') {
        showInfo(t('downloads.customCornerRemoved', { index: result.index }));
      } else if (result.kind === 'complete_invalid') {
        showError(t(`downloads.customInvalid.${result.code}` as 'downloads.customInvalid.too_small'));
      }
    },
    [showError, showInfo],
  );

  const handleCustomDownloadTap = useCallback(
    (lat: number, lon: number) => {
      const state = useCustomDownloadStore.getState();

      if (state.relocateCornerId) {
        const result = moveCustomCorner(state.relocateCornerId, { latitude: lat, longitude: lon });
        reportCustomMutation(result);
        return;
      }

      const picked = nearestDownloadCorner(lat, lon, state.corners);
      if (picked) {
        selectCustomCorner(picked.id);
        return;
      }

      if (state.selectedCornerId) {
        selectCustomCorner(null);
        return;
      }

      if (state.corners.length < 4) {
        const result = addCustomCorner({ latitude: lat, longitude: lon });
        reportCustomMutation(result);
      }
    },
    [addCustomCorner, moveCustomCorner, reportCustomMutation, selectCustomCorner],
  );

  const handleCustomCornerMove = useCallback(
    (cornerId: string) => {
      startRelocateCustomCorner(cornerId);
    },
    [startRelocateCustomCorner],
  );

  const handleCustomCornerDelete = useCallback(
    async (cornerId: string) => {
      const corner = useCustomDownloadStore.getState().corners.find((c) => c.id === cornerId);
      if (!corner) return;
      const confirmed = await useConfirmStore.getState().requestConfirm({
        title: t('downloads.customCornerDeleteTitle'),
        message: t('downloads.customCornerDeleteBody', { index: corner.index }),
        confirmLabel: t('downloads.customCornerDelete'),
        cancelLabel: t('common.dismiss'),
        destructive: true,
      });
      if (!confirmed) return;
      const result = removeCustomCorner(cornerId);
      reportCustomMutation(result);
    },
    [removeCustomCorner, reportCustomMutation],
  );

  const selectedCustomCorner = customSelectedCornerId
    ? customCorners.find((c) => c.id === customSelectedCornerId) ?? null
    : null;

  useEffect(() => {
    if (passageMapPlanning) return;
    setPlanningSelectedWaypointId(null);
  }, [passageMapPlanning]);

  useEffect(() => {
    if (!planningPassageId) {
      setPlanningSelectedWaypointId(null);
      setPlanningOpenEditOnTap(false);
    }
  }, [planningPassageId]);

  useEffect(() => {
    setFollowActive(followMode);
  }, [followMode]);

  const handleAddPlanningWaypoint = useCallback(
    async (lat: number, lon: number) => {
      if (!planningPassageId || addingPlanningWaypointRef.current) return;
      addingPlanningWaypointRef.current = true;
      try {
        setPlanningSelectedWaypointId(null);
        setWaypointHit(null);
        await addMapWaypointToPassage(planningPassageId, lat, lon);
        void pulseUiAcknowledgement();
      } catch {
        showError(t('passage.coordsSaveFailed'));
      } finally {
        addingPlanningWaypointRef.current = false;
      }
    },
    [planningPassageId, showError],
  );

  const handleStartNewPassageFromMap = useCallback(
    async (lat: number, lon: number) => {
      try {
        const id = await startNewPassageFromMap(lat, lon);
        if (!id) return;
        void pulseUiAcknowledgement();
      } catch {
        showError(t('passage.mapPassageStartFailed'));
      }
    },
    [showInfo, showError],
  );

  useEffect(() => {
    const shouldKeepAwake = keepAwakeUnderway && followMode && !screenLocked;
    if (!shouldKeepAwake) {
      void deactivateKeepAwake('seacheck-navigation');
      return;
    }
    void activateKeepAwakeAsync('seacheck-navigation');
    return () => {
      void deactivateKeepAwake('seacheck-navigation');
    };
  }, [keepAwakeUnderway, followMode, screenLocked]);

  useEffect(() => {
    if (!mapPreviewTrackId || mapPreviewLine.length < 2) return;
    const bounds = boundsFromLonLat(mapPreviewLine);
    if (!bounds) return;
    setFollowActive(false);
    cameraRef.current?.fitBounds(bounds, { padding: { top: 96, right: 48, bottom: 160, left: 48 }, duration: 400 });
  }, [mapPreviewTrackId, mapPreviewLine]);

  useEffect(() => {
    if (!customSelecting) {
      customCameraFitSigRef.current = '';
      return;
    }
    if (!mapStyleLoaded || customCorners.length === 0) return;
    const sig = customCorners.map((c) => `${c.id}:${c.latitude},${c.longitude}`).join('|');
    if (customCameraFitSigRef.current === sig) return;
    customCameraFitSigRef.current = sig;
    setFollowActive(false);
    const padding = { top: 96, right: 48, bottom: CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX + 72, left: 48 };
    if (customCorners.length === 1) {
      const corner = customCorners[0]!;
      cameraRef.current?.jumpTo({
        center: [corner.longitude, corner.latitude],
        zoom: Math.max(mapZoom, 12),
      });
      return;
    }
    const bounds = boundsFromPoints(customCorners);
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding, duration: 300 });
  }, [customSelecting, customCorners, mapStyleLoaded, mapZoom]);

  useEffect(() => {
    if (!planningPassageId) {
      planningCameraFitRef.current = null;
      return;
    }
    const lastFit = planningCameraFitRef.current;
    if (
      !mapStyleLoaded ||
      (lastFit?.passageId === planningPassageId && lastFit.revision === planningRevision)
    ) {
      return;
    }
    void usePassageStore.getState().getPassageDetail(planningPassageId).then((detail) => {
      planningCameraFitRef.current = { passageId: planningPassageId, revision: planningRevision };
      if (!detail || detail.waypoints.length === 0) return;
      const bounds = boundsFromWaypoints(detail.waypoints);
      if (!bounds) return;
      setFollowActive(false);
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 96, right: 48, bottom: PASSAGE_PLANNING_PANEL_CONTENT_MAX, left: 48 },
        duration: 400,
      });
    });
  }, [planningPassageId, planningRevision, mapStyleLoaded]);

  useEffect(() => {
    setMapStyleLoaded(false);
  }, [chartStyleUri]);

  useEffect(() => {
    if (!mapStyleLoaded || !pendingOfflineViewport) return;
    cameraRef.current?.jumpTo({
      center: pendingOfflineViewport.center,
      zoom: pendingOfflineViewport.zoom,
    });
  }, [mapStyleLoaded, pendingOfflineViewport, offlineViewportGeneration]);

  const navigationMapKey = useMemo(
    () =>
      Platform.OS === 'android'
        ? `nav-chart-${formFactor}-${isLandscape ? 'land' : 'port'}-${chartStyleUri ?? 'pending'}`
        : `nav-chart-${chartStyleUri ?? 'pending'}`,
    [formFactor, isLandscape, chartStyleUri],
  );

  useMapCameraFollow({
    cameraRef,
    enabled:
      followActive &&
      followMode &&
      Boolean(boatFix) &&
      (!isInstrumentsOnlyLayout || showChartInInstrumentsOnly),
    mapReady: mapStyleLoaded,
    courseUp: mapCourseUp,
    followZoom: mapFollowZoom,
    fix: boatFix,
  });

  useEffect(() => {
    if (followActive && followMode && mapStyleLoaded) {
      setMapZoom(mapFollowZoom);
    }
  }, [followActive, followMode, mapFollowZoom, mapStyleLoaded]);

  const dismissChartDetails = useCallback(() => {
    setWaypointHit(null);
    setTrackPointHit(null);
    setSeamarkHit(null);
  }, []);

  useEffect(() => {
    if (!screenLocked) return;
    setLongPressAction(null);
    dismissChartDetails();
  }, [screenLocked, dismissChartDetails]);

  const openLocationMenu = useCallback(
    (lat: number, lon: number) => {
      dismissChartDetails();
      void pulseUiAcknowledgement();
      setLongPressAction({ lat, lon, coordLabel: formatCoordinates(coordFormat, lat, lon) });
    },
    [coordFormat, dismissChartDetails],
  );

  const handleSeamarkLookup = useCallback(
    async (lon: number, lat: number) => {
      if (mobTarget || screenLocked) return;
      setSeamarkLoading(true);
      try {
        const local = await queryLocalSeamarkAtTap(lat, lon);
        if (local) {
          setWaypointHit(null);
          setTrackPointHit(null);
          setSeamarkHit(local);
          return;
        }
        const online = await lookupChartObjectOnline(lat, lon);
        if (online) {
          setWaypointHit(null);
          setTrackPointHit(null);
          setSeamarkHit(online);
          return;
        }
        showInfo(t('map.seamarkLookupNone'));
      } catch {
        showInfo(t('map.seamarkLookupFailed'));
      } finally {
        setSeamarkLoading(false);
      }
    },
    [mobTarget, screenLocked, showInfo],
  );

  const handleMapTap = useCallback(
    (lon: number, lat: number) => {
      if (mobTarget || screenLocked) return;

      const tap = resolveMapChartTapAction(
        lat,
        lon,
        {
          savedWaypoints: mapTapWaypoints,
          recordingTrackId,
          liveInspectPoints,
          mapPreviewPoints,
        },
        mapChartHasOpenDetail({ seamarkHit, waypointHit, trackPointHit }),
      );

      switch (tap.action) {
        case 'open-waypoint':
          setTrackPointHit(null);
          setSeamarkHit(null);
          setWaypointHit(tap.waypoint);
          break;
        case 'open-track-point':
          setWaypointHit(null);
          setSeamarkHit(null);
          setTrackPointHit(tap.point);
          break;
        case 'dismiss-details':
          dismissChartDetails();
          break;
        case 'none':
          break;
      }
    },
    [
      dismissChartDetails,
      liveInspectPoints,
      mapPreviewPoints,
      mobTarget,
      recordingTrackId,
      mapTapWaypoints,
      screenLocked,
      seamarkHit,
      trackPointHit,
      waypointHit,
    ],
  );

  const handlePlanningMapTap = useCallback(
    async (lon: number, lat: number) => {
      if (!planningPassageId) return;
      const detail = await getPassageDetail(planningPassageId);
      const pickCtx = {
        savedWaypoints: [],
        passageWaypoints: detail?.waypoints ?? [],
        recordingTrackId: null,
        liveInspectPoints: [],
        mapPreviewPoints: [],
      };
      const detailsOpen = mapChartHasOpenDetail({ seamarkHit, waypointHit, trackPointHit });
      const pick = pickMapChartFeatures(lat, lon, pickCtx, PLANNING_WAYPOINT_PICK_RADIUS_NM);

      if (pick.kind === 'waypoint') {
        setTrackPointHit(null);
        setSeamarkHit(null);
        setPlanningSelectedWaypointId(pick.waypoint.id);
        setWaypointHit(pick.waypoint);
        setPlanningOpenEditOnTap(allowRouteEdits);
        return;
      }

      if (detailsOpen) {
        dismissChartDetails();
        setPlanningSelectedWaypointId(null);
        setPlanningOpenEditOnTap(false);
      }
    },
    [
      planningPassageId,
      allowRouteEdits,
      getPassageDetail,
      seamarkHit,
      waypointHit,
      trackPointHit,
      dismissChartDetails,
    ],
  );

  const planningModeHint = passageMapPlanning
    ? allowRouteEdits
      ? t('passage.mapPlanningBannerShort')
      : t('passage.mapPlanningViewBannerShort')
    : null;

  function handleLongPressAnchor(lat: number, lon: number) {
    void (async () => {
      try {
        const currentFix = useLocationStore.getState().fix;
        if (!currentFix || !isValidCoordinate(currentFix.latitude, currentFix.longitude)) {
          const confirmed = await useConfirmStore.getState().requestConfirm({
            title: t('map.anchorMapNoGpsTitle'),
            message: t('map.anchorMapNoGpsBody'),
            confirmLabel: t('map.anchorMapPositionConfirm'),
            cancelLabel: t('common.dismiss'),
            destructive: false,
          });
          if (!confirmed) return;
        } else {
          const driftNm = distanceNm(
            [currentFix.longitude, currentFix.latitude],
            [lon, lat],
          );
          if (driftNm > 0.05) {
            const confirmed = await useConfirmStore.getState().requestConfirm({
              title: t('map.anchorMapPositionTitle'),
              message: t('map.anchorMapPositionBody'),
              confirmLabel: t('map.anchorMapPositionConfirm'),
              cancelLabel: t('common.dismiss'),
              destructive: false,
            });
            if (!confirmed) return;
          }
        }
        const anchorActive = useNavigationStore.getState().anchorAlarm?.active;
        if (anchorActive) {
          const confirmed = await useConfirmStore.getState().requestConfirm({
            title: t('map.anchorReplaceTitle'),
            message: t('map.anchorReplaceBody'),
            confirmLabel: t('map.anchorReplaceConfirm'),
            cancelLabel: t('common.dismiss'),
            destructive: true,
          });
          if (!confirmed) return;
        }
        await activateAnchorAlarmAt(lat, lon, undefined, { replace: true });
      } catch {
        showError(t('map.anchorSetFailed'));
      }
    })();
  }

  const openPassage = useCallback(() => {
    if (activePassageId) {
      navigation.navigate('Passage', { screen: 'PassageDetail', params: { passageId: activePassageId } });
      return;
    }
    navigation.navigate('Passage');
  }, [navigation, activePassageId]);
  const openTracks = useCallback(() => navigation.navigate('Tracks'), [navigation]);

  const mapOverlays = !customSelecting && !passageMapPlanning ? (
    <View pointerEvents="box-none" style={[styles.topOverlay, { top: mapBottom.top, left: mapBottom.left, right: mapBottom.right }]}>
      <MapTopChrome
        actionColumnWidth={showSideActions ? mapBottom.actionColumnWidth : 0}
        onOpenDownloads={() => navigation.navigate('Downloads')}
        onOpenSettings={() => navigation.navigate('Settings')}
        onOpenTracks={openTracks}
        showRecenter={showRecenter}
        onRecenter={() => setFollowActive(true)}
        viewportLatitude={mapCenter.latitude}
        viewportLongitude={mapCenter.longitude}
        modeHint={planningModeHint}
      />
    </View>
  ) : null;

  const mapNode = !offlineHydrated ? (
    <View style={[styles.map, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.textMuted }}>{t('boot.loading')}</Text>
    </View>
  ) : exclusiveChartDownload ? (
    <View
      style={[styles.map, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }]}
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.statusSummaryActiveTitle')}
    >
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
        {t('downloads.statusSummaryActiveTitle')}
      </Text>
      <Text style={{ color: colors.textMuted, lineHeight: 22, textAlign: 'center' }}>
        {t('downloads.statusSummaryActiveHint')}
      </Text>
    </View>
  ) : chartStyleUri ? (
    <View style={styles.mapHost} pointerEvents={screenLocked ? 'none' : 'box-none'}>
      <View style={styles.mapClip}>
        <Map
        key={navigationMapKey}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="image"
        accessibilityLabel={mapAccessibilityLabel}
        accessibilityHint={t('map.chartA11yHint')}
        mapStyle={chartStyleUri}
        attribution
        attributionPosition={{
          bottom: mapBottom.attributionBottom,
          left: mapBottom.left,
        }}
        compass
        compassPosition={{
          bottom: mapBottom.compassBottom,
          right: mapBottom.right,
        }}
        scaleBar={showScaleBar}
        scaleBarPosition={{
          bottom: mapBottom.attributionBottom + 8,
          left: mapBottom.left,
        }}
      onDidFinishLoadingStyle={() => {
        setMapStyleLoaded(true);
        reportNavigationChartReady();
      }}
      onDidFinishLoadingMap={() => {
        setMapStyleLoaded(true);
        reportNavigationChartReady();
      }}
      onDidFinishRenderingMapFully={() => {
        reportNavigationChartReady();
      }}
      onDidFailLoadingMap={() => {
        setMapStyleLoaded(false);
        if (chartStyleUri && isMapScreenFocused()) {
          markOfflineMapEngineStyleFailed(chartStyleUri);
        }
      }}
      onRegionWillChange={(e) => {
        if (shouldPauseFollowOnRegionChange(e.nativeEvent.userInteraction, followMode)) {
          setFollowActive(false);
        }
      }}
      onRegionIsChanging={(e) => {
        const [lon, lat] = e.nativeEvent.center;
        setMapCenter({ latitude: lat, longitude: lon });
        if (typeof e.nativeEvent.zoom === 'number' && Number.isFinite(e.nativeEvent.zoom)) {
          setMapZoom(e.nativeEvent.zoom);
        }
      }}
      onRegionDidChange={(e) => {
        const [lon, lat] = e.nativeEvent.center;
        setMapCenter({ latitude: lat, longitude: lon });
        if (typeof e.nativeEvent.zoom === 'number' && Number.isFinite(e.nativeEvent.zoom)) {
          setMapZoom(e.nativeEvent.zoom);
        }
      }}
      onLongPress={(e) => {
        if (customSelecting || screenLocked || mobTarget) return;
        suppressNextPressRef.current = true;
        const [lon, lat] = e.nativeEvent.lngLat;
        if (passageMapPlanning && allowRouteEdits) {
          void handleAddPlanningWaypoint(lat, lon);
          return;
        }
        openLocationMenu(lat, lon);
      }}
      onPress={(e) => {
        if (screenLocked) return;
        if (suppressNextPressRef.current) {
          suppressNextPressRef.current = false;
          return;
        }
        const [lon, lat] = e.nativeEvent.lngLat;
        if (customSelecting) {
          handleCustomDownloadTap(lat, lon);
          return;
        }
        if (passageMapPlanning) {
          void handlePlanningMapTap(lon, lat);
          return;
        }
        handleMapTap(lon, lat);
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: initialMapCenter,
          zoom: followMode ? mapFollowZoom : 11,
        }}
      />
      {!passageMapPlanning ? <CourseVectorOverlay mapZoom={mapZoom} fallbackZoom={mapFollowZoom} /> : null}
      <ExpoLocationPuck mapZoom={mapZoom} fallbackZoom={mapFollowZoom} />
      <MapOverlays
        planningMode={passageMapPlanning && !customSelecting}
        planningSelectedWaypointId={planningSelectedWaypointId}
      />
      <CustomDownloadOverlays />
    </Map>
      </View>
      {!customSelecting ? (
        <View pointerEvents="box-none" style={styles.mapOverlayLayer}>
          {mapOverlays}
          {passageMapPlanning && !mobTarget ? (
            <View
              pointerEvents="box-none"
              style={[styles.topOverlay, { top: mapBottom.top, left: mapBottom.left, right: mapBottom.right }]}
            >
              <PassageMapPlanningGuideBanner allowRouteEdits={allowRouteEdits} />
              <MapTopChrome
                actionColumnWidth={0}
                onOpenDownloads={() => navigation.navigate('Downloads')}
                onOpenSettings={() => navigation.navigate('Settings')}
                onOpenTracks={openTracks}
                showRecenter={showRecenter}
                onRecenter={() => setFollowActive(true)}
                viewportLatitude={mapCenter.latitude}
                viewportLongitude={mapCenter.longitude}
                modeHint={planningModeHint}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  ) : (
    <View style={[styles.map, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }]} accessibilityRole="alert">
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{t('map.chartInitFailedTitle')}</Text>
      <Text style={{ color: colors.textMuted, lineHeight: 22, textAlign: 'center' }}>{t('map.chartInitFailedBody')}</Text>
      <Button
        label={t('common.retry')}
        onPress={() => {
          setChartRetryBusy(true);
          void hydrateOffline().finally(() => setChartRetryBusy(false));
        }}
        loading={chartRetryBusy}
        testID="map.chartRetry"
        style={{ minHeight: minTouch }}
      />
    </View>
  );

  const mapPaneHost = (
    <View style={styles.mapPaneHost}>
      {mapNode}
      {safetyChromePlacement === 'mapPane' ? (
        <View pointerEvents="box-none" style={styles.mapOverlayLayer}>
          <MapChrome
            onMobDropped={switchLayoutOnMob}
            showAnchor={!(isInstrumentsOnlyLayout && !showChartInInstrumentsOnly)}
            screenLocked={screenLocked}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="screen.map">
      {isInstrumentsOnlyLayout && !showChartInInstrumentsOnly ? (
        <InstrumentsOnlyShell
          fix={fix}
          onOpenPassage={openPassage}
          topChrome={
            <MapTopChrome
              actionColumnWidth={instrumentsTopChromeLayout.actionColumnWidth}
              onOpenDownloads={() => navigation.navigate('Downloads')}
              onOpenSettings={() => navigation.navigate('Settings')}
              onOpenTracks={openTracks}
              showRecenter={false}
              onRecenter={() => setFollowActive(true)}
              viewportLatitude={mapCenter.latitude}
              viewportLongitude={mapCenter.longitude}
              modeHint={planningModeHint}
            />
          }
          screenLocked={screenLocked}
        />
      ) : showChartInInstrumentsOnly && isInstrumentsOnlyLayout ? (
        <View style={styles.mapOnlyHost}>{mapNode}</View>
      ) : (
        <ResponsiveMapShell
          map={mapPaneHost}
          instrumentPanel={
            effectiveSplit ? (
              <MapInstrumentPanel fix={fix} onOpenPassage={openPassage} />
            ) : null
          }
        />
      )}

      {customSelecting && !mobTarget ? (
        <>
          <View pointerEvents="box-none" style={[styles.topOverlay, { top: chrome.top, left: chrome.left, right: chrome.right }]}>
            <View
              style={[styles.hint, { backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.sm }]}
              accessibilityRole="text"
            >
              <Text style={[styles.hintText, { color: colors.primaryText, fontWeight: '700' }]}>
                {t('downloads.customMapBanner')}
              </Text>
            </View>
          </View>
          <CustomDownloadMapPanel />
        </>
      ) : null}

      <CustomDownloadCornerSheet
        visible={customSelecting && selectedCustomCorner != null}
        corner={selectedCustomCorner}
        onClose={() => selectCustomCorner(null)}
        onMoveOnMap={handleCustomCornerMove}
        onDelete={(id) => void handleCustomCornerDelete(id)}
      />

      {passageMapPlanning && !customSelecting && !mobTarget ? <PassageMapPlanningPanel /> : null}

      {surface.showBottomDock && !effectiveSplit && (isMinimalLayout || (isInstrumentsOnlyLayout && showChartInInstrumentsOnly)) ? (
        <MapBottomDock fix={fix} onOpenPassage={openPassage} />
      ) : null}
      {surface.showBottomDock && !effectiveSplit && isMapForwardLayout ? (
        <MapInstrumentDock fix={fix} onOpenPassage={openPassage} />
      ) : null}
      {safetyChromePlacement === 'root' ? (
        <MapChrome
          onMobDropped={switchLayoutOnMob}
          showAnchor={!(isInstrumentsOnlyLayout && !showChartInInstrumentsOnly)}
          screenLocked={screenLocked}
        />
      ) : null}
      {mobTarget ? <MobNavigateBackOverlay /> : null}
      <WaypointMapDetailSheet
        waypoint={waypointHit}
        onClose={() => {
          setWaypointHit(null);
          setPlanningSelectedWaypointId(null);
          setPlanningOpenEditOnTap(false);
        }}
        onCopied={() => showInfo(t('map.coordsCopied'))}
        onDeleted={() => {
          setPlanningSelectedWaypointId(null);
          setPlanningOpenEditOnTap(false);
        }}
        planningPassageId={passageMapPlanning ? planningPassageId : null}
        allowRouteEdits={allowRouteEdits}
        autoOpenEdit={planningOpenEditOnTap}
      />
      <TrackPointMapDetailSheet
        point={trackPointHit}
        trackName={
          recordingTrackId && trackPointHit?.track_id === recordingTrackId
            ? tracks.find((tr) => tr.id === recordingTrackId)?.name ?? t('tracks.recordingLabel')
            : tracks.find((tr) => tr.id === mapPreviewTrackId)?.name
        }
        onClose={() => setTrackPointHit(null)}
        onCopied={() => showInfo(t('map.coordsCopied'))}
      />
      <SeamarkDetailSheet hit={seamarkHit} onClose={() => setSeamarkHit(null)} onCopied={() => showInfo(t('map.coordsCopied'))} />
      <AnchorWatchLimitedSheet />
      <ActionSheet
        visible={longPressAction != null}
        onClose={() => setLongPressAction(null)}
        title={t('map.locationMenuTitle')}
        message={longPressAction ? `${longPressAction.coordLabel}\n${t('map.locationMenuHint')}` : undefined}
        testID="map.longPress"
        options={
          longPressAction
            ? [
                ...(!passageMapPlanning
                  ? [
                      {
                        label: t('passage.mapStartPassageHere'),
                        testID: 'map.longPress.startPassage',
                        onPress: () => void handleStartNewPassageFromMap(longPressAction.lat, longPressAction.lon),
                      },
                      {
                        label: t('map.anchorHere'),
                        testID: 'map.longPress.anchor',
                        onPress: () => handleLongPressAnchor(longPressAction.lat, longPressAction.lon),
                      },
                    ]
                  : []),
                {
                  label: t('map.copyCoordsAction'),
                  testID: 'map.longPress.copy',
                  onPress: () => {
                    void Clipboard.setStringAsync(longPressAction.coordLabel).then(() => showInfo(t('map.coordsCopied')));
                  },
                },
                {
                  label: t('map.lookupSeamarkAction'),
                  testID: 'map.longPress.seamark',
                  onPress: () => void handleSeamarkLookup(longPressAction.lon, longPressAction.lat),
                },
              ]
            : []
        }
      />
      {seamarkLoading ? (
        <View pointerEvents="none" style={[styles.seamarkLoading, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted }}>{t('map.seamarkLoading')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  mapPaneHost: { flex: 1, minHeight: 0, minWidth: 0 },
  mapOnlyHost: { flex: 1, minHeight: 0 },
  mapHost: { flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' },
  mapClip: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  map: { flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' },
  mapOverlayLayer: { ...StyleSheet.absoluteFill, zIndex: 50, elevation: 50, overflow: 'hidden' },
  topOverlay: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 10 },
  hintText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  seamarkLoading: { position: 'absolute', top: '45%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
