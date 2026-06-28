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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Device from 'expo-device';

import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { shouldShowChartRasterTiles, selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
import { useMapCameraFollow } from '../../hooks/useMapCameraFollow';
import { CustomDownloadMapPanel } from '../downloads/CustomDownloadMapPanel';
import { PassageMapPlanningPanel } from '../passage/PassageMapPlanningPanel';
import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import {
  addMapWaypointToPassage,
  startNewPassageFromMap,
} from '../../lib/passage/passageMapPlanning';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import { ResponsiveMapShell } from '../responsive/ResponsiveMapShell';
import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { configureMapLogging } from '../../map/mapLogging';
import { formatCoordinates } from '../../map/coords';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useLocationStore, isFixStale } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useMeasureDistanceStore } from '../../store/measureDistanceStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useConfirmStore } from '../../store/confirmStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore } from '../../store/passageStore';
import { useTrackStore } from '../../store/trackStore';
import { mapChartHasOpenDetail, resolveMapChartTapAction } from '../../lib/map/mapChartInteraction';
import { buildMapChartAccessibilityLabel } from '../../lib/map/mapAccessibility';
import { resolveBoatHeadingDeg } from '../../lib/geo/cog';
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
import { InstrumentsOnlyShell } from './InstrumentsOnlyShell';
import { MapInstruments } from './MapInstruments';
import { MapTopChrome } from './MapTopChrome';
import { MobNavigateBackOverlay } from './MobNavigateBackOverlay';
import { SeamarkDetailSheet } from './SeamarkDetailSheet';
import { TrackPointMapDetailSheet } from './TrackPointMapDetailSheet';
import { WaypointMapDetailSheet } from './WaypointMapDetailSheet';
import { MapOverlays } from './MapOverlays';
import { MeasureDistanceOverlay } from './MeasureDistanceOverlay';
import { MeasureDistancePanel } from './MeasureDistancePanel';
import { PlanningSeamarksOverlay } from './PlanningSeamarksOverlay';
import { mapChromeInsets } from './mapChromeInsets';
import { boundsFromLonLat, boundsFromWaypoints } from '../../lib/map/passageBounds';
import {
  lookupChartObjectOnline,
  planningMarkToSeamarkHit,
  queryLocalSeamarkAtTap,
  type SeamarkHit,
} from '../../lib/seamarks/querySeamark';
import type { PlanningSeamarkFeature } from '../../lib/seamarks/queryPlanningSeamarks';
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
  const seamarkPlanning = useSettingsStore((s) => s.seamarkPlanning);
  const chartBaseStyle = useSettingsStore((s) => s.chartBaseStyle);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const hydrateOffline = useOfflinePackStore((s) => s.hydrate);
  const offlineRegions = useOfflinePackStore((s) => s.regions);
  const hasReadyPack = selectHasReadyOfflinePack(offlineRegions);
  const createWaypoint = useWaypointStore((s) => s.create);
  const savedWaypoints = useWaypointStore((s) => s.items);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const planningPassageId = usePassageMapPlanningStore((s) => s.passageId);
  const passageMapPlanning = planningPassageId != null;
  const measureActive = useMeasureDistanceStore((s) => s.active);
  const addMeasurePoint = useMeasureDistanceStore((s) => s.addPoint);
  const setCustomCorner = useCustomDownloadStore((s) => s.setCorner);
  const [showRangeRings, setShowRangeRings] = useState(false);
  const [followActive, setFollowActive] = useState(followMode);
  const layoutPreset = useEffectiveLayoutPreset();
  const isMinimalLayout = layoutPreset === 'minimal';
  const isInstrumentsOnlyLayout = layoutPreset === 'instruments-only';
  const showChartInInstrumentsOnly = customSelecting || passageMapPlanning;
  const showRecenter =
    followMode && !followActive && !screenLocked && (!isInstrumentsOnlyLayout || showChartInInstrumentsOnly);
  const mapBottom = useMapBottomLayout({ showSideActions: !isMinimalLayout && !screenLocked });
  const [seamarkHit, setSeamarkHit] = useState<SeamarkHit | null>(null);
  const [waypointHit, setWaypointHit] = useState<WaypointRow | null>(null);
  const [trackPointHit, setTrackPointHit] = useState<TrackPointRow | null>(null);
  const [seamarkLoading, setSeamarkLoading] = useState(false);
  const initialMapCenter = useMemo(
    () => resolveMapInitialCenter(fix ?? lastGoodFix),
    [fix?.latitude, fix?.longitude, lastGoodFix?.latitude, lastGoodFix?.longitude],
  );
  const [mapCenter, setMapCenter] = useState(() => ({
    latitude: initialMapCenter[1],
    longitude: initialMapCenter[0],
  }));
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const [chartRetryBusy, setChartRetryBusy] = useState(false);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false);
  const [longPressAction, setLongPressAction] = useState<{ lat: number; lon: number; coordLabel: string } | null>(null);
  const suppressNextPressRef = useRef(false);
  const planningMarkTapRef = useRef(false);
  const planningCameraFitRef = useRef<string | null>(null);
  const isOffline = useIsEffectivelyOffline();
  const chartCoverage = useChartCoverageAtPoint(mapCenter.latitude, mapCenter.longitude);
  const showScaleBar = Platform.OS === 'ios' || Device.isDevice;
  const chartRasterVisible = shouldShowChartRasterTiles(isOffline, hasReadyPack, chartCoverage.covered);
  const boatFix = fix ?? lastGoodFix;

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
    setFollowActive(followMode);
  }, [followMode]);

  useEffect(() => {
    if (measureActive) {
      setFollowActive(false);
    }
  }, [measureActive]);

  useEffect(() => {
    if (isInstrumentsOnlyLayout && measureActive) {
      useMeasureDistanceStore.getState().stop();
      showInfo(t('map.measureNeedsChart'));
    }
  }, [isInstrumentsOnlyLayout, measureActive, showInfo]);

  useEffect(() => {
    if (passageMapPlanning && measureActive) {
      useMeasureDistanceStore.getState().stop();
      showInfo(t('map.measureStoppedForPlanning'));
    }
  }, [passageMapPlanning, measureActive, showInfo]);

  const handleAddPlanningWaypoint = useCallback(
    async (lat: number, lon: number) => {
      if (!planningPassageId) return;
      try {
        await addMapWaypointToPassage(planningPassageId, lat, lon);
        void pulseUiAcknowledgement();
        showInfo(t('passage.mapWaypointAdded'));
      } catch {
        showError(t('passage.coordsSaveFailed'));
      }
    },
    [planningPassageId, showInfo, showError],
  );

  const handleStartNewPassageFromMap = useCallback(
    async (lat: number, lon: number) => {
      try {
        await startNewPassageFromMap(lat, lon);
        void pulseUiAcknowledgement();
        showInfo(t('passage.mapPassageStarted'));
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
    if (!planningPassageId) {
      planningCameraFitRef.current = null;
      return;
    }
    if (!mapStyleLoaded || planningCameraFitRef.current === planningPassageId) return;
    planningCameraFitRef.current = planningPassageId;
    void usePassageStore.getState().getPassageDetail(planningPassageId).then((detail) => {
      if (!detail || detail.waypoints.length === 0) return;
      const bounds = boundsFromWaypoints(detail.waypoints);
      if (!bounds) return;
      setFollowActive(false);
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 120, right: 48, bottom: 300, left: 48 },
        duration: 400,
      });
    });
  }, [planningPassageId, mapStyleLoaded]);

  const applyLayerVisibility = useCallback(async (visible: boolean) => {
    try {
      await mapRef.current?.setSourceVisibility(visible, 'carto-base');
      await mapRef.current?.setSourceVisibility(visible, 'openseamap-seamarks');
    } catch {
      /* map not ready */
    }
  }, []);

  useEffect(() => {
    if (!mapStyleLoaded) return;
    void applyLayerVisibility(chartRasterVisible);
  }, [chartRasterVisible, mapStyleLoaded, applyLayerVisibility]);

  useEffect(() => {
    setMapStyleLoaded(false);
  }, [chartStyleUri, chartBaseStyle]);

  useMapCameraFollow({
    cameraRef,
    enabled:
      followActive &&
      followMode &&
      Boolean(boatFix) &&
      (!isInstrumentsOnlyLayout || showChartInInstrumentsOnly) &&
      !measureActive,
    mapReady: mapStyleLoaded,
    courseUp: mapCourseUp,
    followZoom: mapFollowZoom,
    fix: boatFix,
  });

  const dismissChartDetails = useCallback(() => {
    setWaypointHit(null);
    setTrackPointHit(null);
    setSeamarkHit(null);
  }, []);

  const openLocationMenu = useCallback(
    (lat: number, lon: number) => {
      dismissChartDetails();
      void pulseUiAcknowledgement();
      setLongPressAction({ lat, lon, coordLabel: formatCoordinates(coordFormat, lat, lon) });
    },
    [coordFormat, dismissChartDetails],
  );

  const handlePlanningMarkPress = useCallback(
    (mark: PlanningSeamarkFeature) => {
      if (screenLocked || measureActive) return;
      planningMarkTapRef.current = true;
      void pulseUiAcknowledgement();
      setWaypointHit(null);
      setTrackPointHit(null);
      setSeamarkHit(planningMarkToSeamarkHit(mark));
    },
    [measureActive, screenLocked],
  );

  const handleSeamarkLookup = useCallback(
    async (lon: number, lat: number) => {
      if (mobTarget || screenLocked || measureActive) return;
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
    [measureActive, mobTarget, screenLocked, showInfo],
  );

  const handleMapTap = useCallback(
    (lon: number, lat: number) => {
      if (mobTarget || screenLocked || measureActive) return;

      const tap = resolveMapChartTapAction(
        lat,
        lon,
        {
          savedWaypoints,
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
      measureActive,
      mobTarget,
      recordingTrackId,
      savedWaypoints,
      screenLocked,
      seamarkHit,
      trackPointHit,
      waypointHit,
    ],
  );

  function handleLongPressAnchor(lat: number, lon: number) {
    void (async () => {
      try {
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

  const mapOverlays = !customSelecting ? (
    <>
      <View pointerEvents="box-none" style={[styles.topOverlay, { top: mapBottom.top, left: mapBottom.left, right: mapBottom.right }]}>
        <MapTopChrome
          actionColumnWidth={mapBottom.actionColumnWidth}
          onOpenDownloads={() => navigation.navigate('Downloads')}
          onOpenSettings={() => navigation.navigate('Settings')}
          onOpenPassage={() => navigation.navigate('Passage')}
          showRecenter={showRecenter}
          onRecenter={() => setFollowActive(true)}
          viewportLatitude={mapCenter.latitude}
          viewportLongitude={mapCenter.longitude}
          showPassageFollow={isMinimalLayout || isInstrumentsOnlyLayout}
          modeHint={passageMapPlanning ? t('passage.mapPlanningBanner') : null}
        />
      </View>
      {!isMinimalLayout ? (
        <MapChrome
          showRangeRings={showRangeRings}
          onToggleRangeRings={() => setShowRangeRings((v) => !v)}
          screenLocked={screenLocked}
        />
      ) : null}
    </>
  ) : null;

  const mapNode = !offlineHydrated ? (
    <View style={[styles.map, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.textMuted }}>{t('boot.loading')}</Text>
    </View>
  ) : chartStyleUri ? (
    <View style={styles.map} pointerEvents={screenLocked ? 'none' : 'box-none'}>
      <Map
        key={`nav-chart-${chartBaseStyle}`}
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
          bottom: mapBottom.actionsBottom + mapBottom.actionStackHeight + 12,
          right: mapBottom.right,
        }}
        scaleBar={showScaleBar}
        scaleBarPosition={{
          bottom: mapBottom.attributionBottom + 8,
          left: mapBottom.left,
        }}
      onDidFinishLoadingStyle={() => setMapStyleLoaded(true)}
      onDidFailLoadingMap={() => setMapStyleLoaded(false)}
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
        if (customSelecting || screenLocked || measureActive || mobTarget) return;
        suppressNextPressRef.current = true;
        const [lon, lat] = e.nativeEvent.lngLat;
        openLocationMenu(lat, lon);
      }}
      onPress={(e) => {
        if (screenLocked) return;
        if (suppressNextPressRef.current) {
          suppressNextPressRef.current = false;
          return;
        }
        if (planningMarkTapRef.current) {
          planningMarkTapRef.current = false;
          return;
        }
        const [lon, lat] = e.nativeEvent.lngLat;
        if (customSelecting) {
          const state = useCustomDownloadStore.getState();
          setCustomCorner({ latitude: lat, longitude: lon });
          if (!state.cornerA) {
            showInfo(t('downloads.customCornerFirst'));
          } else if (!state.cornerB) {
            showInfo(t('downloads.customCornerSet'));
          } else {
            showInfo(t('downloads.customCornerReset'));
          }
          return;
        }
        if (passageMapPlanning) {
          void handleAddPlanningWaypoint(lat, lon);
          return;
        }
        if (measureActive) {
          addMeasurePoint(lat, lon);
          void pulseUiAcknowledgement();
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
      <CourseVectorOverlay mapZoom={mapZoom} fallbackZoom={mapFollowZoom} />
      <ExpoLocationPuck mapZoom={mapZoom} fallbackZoom={mapFollowZoom} />
      <PlanningSeamarksOverlay
        centerLatitude={mapCenter.latitude}
        centerLongitude={mapCenter.longitude}
        zoom={mapZoom ?? mapFollowZoom}
        config={seamarkPlanning}
        onMarkPress={handlePlanningMarkPress}
      />
      <MapOverlays showRangeRings={showRangeRings} />
      <MeasureDistanceOverlay />
    </Map>
      {!customSelecting ? (
        <View pointerEvents="box-none" style={styles.mapOverlayLayer}>
          {mapOverlays}
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="screen.map">
      {isInstrumentsOnlyLayout && !showChartInInstrumentsOnly ? (
        <InstrumentsOnlyShell
          fix={fix}
          topChrome={
            <MapTopChrome
              actionColumnWidth={mapBottom.actionColumnWidth}
              onOpenDownloads={() => navigation.navigate('Downloads')}
              onOpenSettings={() => navigation.navigate('Settings')}
              onOpenPassage={() => navigation.navigate('Passage')}
              showRecenter={false}
              onRecenter={() => setFollowActive(true)}
              viewportLatitude={mapCenter.latitude}
              viewportLongitude={mapCenter.longitude}
              showPassageFollow
            />
          }
          showRangeRings={showRangeRings}
          onToggleRangeRings={() => setShowRangeRings((v) => !v)}
          screenLocked={screenLocked}
        />
      ) : showChartInInstrumentsOnly && isInstrumentsOnlyLayout ? (
        <View style={styles.mapOnlyHost}>{mapNode}</View>
      ) : (
        <ResponsiveMapShell map={mapNode} panel={<MapInstruments fix={fix} />} />
      )}

      {customSelecting ? (
        <>
          <View pointerEvents="box-none" style={[styles.topOverlay, { top: chrome.top, left: chrome.left, right: chrome.right }]}>
            <View style={[styles.hint, { backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.sm }]}>
              <Text style={[styles.hintText, { color: colors.primaryText, fontWeight: '700' }]}>{t('downloads.customMapBanner')}</Text>
            </View>
          </View>
          <CustomDownloadMapPanel />
        </>
      ) : null}

      {passageMapPlanning && !customSelecting ? <PassageMapPlanningPanel /> : null}

      {measureActive && !customSelecting && !passageMapPlanning ? <MeasureDistancePanel /> : null}

      {isMinimalLayout && !customSelecting && !passageMapPlanning && !mobTarget && !screenLocked && !measureActive ? (
        <MapBottomDock
          fix={fix}
          showRangeRings={showRangeRings}
          onToggleRangeRings={() => setShowRangeRings((v) => !v)}
        />
      ) : null}
      {mobTarget ? <MobNavigateBackOverlay /> : null}
      <WaypointMapDetailSheet
        waypoint={waypointHit}
        onClose={() => setWaypointHit(null)}
        onCopied={() => showInfo(t('map.coordsCopied'))}
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
                ...(passageMapPlanning
                  ? [
                      {
                        label: t('passage.mapAddWaypointHere'),
                        testID: 'map.longPress.passageAdd',
                        onPress: () => void handleAddPlanningWaypoint(longPressAction.lat, longPressAction.lon),
                      },
                    ]
                  : [
                      {
                        label: t('passage.mapStartPassageHere'),
                        testID: 'map.longPress.startPassage',
                        onPress: () => void handleStartNewPassageFromMap(longPressAction.lat, longPressAction.lon),
                      },
                    ]),
                ...(passageMapPlanning
                  ? []
                  : [
                      {
                        label: t('map.dropWaypointConfirm'),
                        testID: 'map.longPress.waypoint',
                        onPress: () =>
                          void createWaypoint({
                            name: t('map.newWaypoint'),
                            latitude: longPressAction.lat,
                            longitude: longPressAction.lon,
                            type: 'generic',
                          })
                            .then(() => {
                              void pulseUiAcknowledgement();
                              showInfo(t('map.waypointSaved'));
                            })
                            .catch(() => showError(t('passage.coordsSaveFailed'))),
                      },
                    ]),
                {
                  label: t('map.anchorHere'),
                  testID: 'map.longPress.anchor',
                  onPress: () => handleLongPressAnchor(longPressAction.lat, longPressAction.lon),
                },
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
  root: { flex: 1 },
  mapOnlyHost: { flex: 1, minHeight: 0 },
  map: { flex: 1, minHeight: 0, overflow: 'hidden' },
  mapOverlayLayer: { ...StyleSheet.absoluteFill, zIndex: 50, elevation: 50 },
  topOverlay: { position: 'absolute', zIndex: 20 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 10 },
  hintText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  seamarkLoading: { position: 'absolute', top: '45%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
