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
import { useMapCameraFollow } from '../../hooks/useMapCameraFollow';
import { useRaceCountdown } from '../../hooks/useRaceCountdown';
import { CustomDownloadMapPanel } from '../downloads/CustomDownloadMapPanel';
import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import { pulseUiAcknowledgement } from '../../services/alarmFeedbackService';
import { ResponsiveMapShell } from '../responsive/ResponsiveMapShell';
import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { configureMapLogging } from '../../map/mapLogging';
import { KIEL_CENTER } from '../../map/constants';
import { formatCoordinates } from '../../map/coords';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useLocationStore } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTrackStore } from '../../store/trackStore';
import { boundsFromLonLat } from '../../lib/map/passageBounds';
import { buildMapChartAccessibilityLabel } from '../../lib/map/mapAccessibility';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ActionSheet } from '../../ui/ActionSheet';
import { AnchorWatchLimitedSheet } from './AnchorWatchLimitedSheet';
import { ExpoLocationPuck } from './ExpoLocationPuck';
import { MapBottomDock } from './MapBottomDock';
import { MapChrome } from './MapChrome';
import { MapInstruments } from './MapInstruments';
import { MapTopChrome } from './MapTopChrome';
import { MobNavigateBackOverlay } from './MobNavigateBackOverlay';
import { ScreenLockOverlay } from './ScreenLockOverlay';
import { SeamarkDetailSheet } from './SeamarkDetailSheet';
import { TrackPointMapDetailSheet } from './TrackPointMapDetailSheet';
import { WaypointMapDetailSheet } from './WaypointMapDetailSheet';
import { MapOverlays } from './MapOverlays';
import { mapChromeInsets } from './mapChromeInsets';
import { nearestTrackPoint } from '../../lib/geo/nearestTrackPoint';
import { nearestWaypoint } from '../../lib/geo/nearestWaypoint';
import { unknownChartObject, queryNearestSeamark, type SeamarkHit } from '../../lib/seamarks/querySeamark';
import type { TrackPointRow, WaypointRow } from '../../lib/db/database';

export function NavigationMap() {
  const raceCountdown = useRaceCountdown();
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);

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
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const hydrateOffline = useOfflinePackStore((s) => s.hydrate);
  const hasReadyPack = useOfflinePackStore((s) => s.hasReadyPack());
  const createWaypoint = useWaypointStore((s) => s.create);
  const savedWaypoints = useWaypointStore((s) => s.items);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const setCustomCorner = useCustomDownloadStore((s) => s.setCorner);
  const [showRangeRings, setShowRangeRings] = useState(false);
  const [followActive, setFollowActive] = useState(followMode);
  const layoutPreset = useEffectiveLayoutPreset();
  const isMinimalLayout = layoutPreset === 'minimal';
  const showRecenter = followMode && !followActive && !screenLocked;
  const mapBottom = useMapBottomLayout({ showSideActions: !isMinimalLayout && !screenLocked });
  const [seamarkHit, setSeamarkHit] = useState<SeamarkHit | null>(null);
  const [waypointHit, setWaypointHit] = useState<WaypointRow | null>(null);
  const [trackPointHit, setTrackPointHit] = useState<TrackPointRow | null>(null);
  const [seamarkLoading, setSeamarkLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState({ latitude: KIEL_CENTER[1], longitude: KIEL_CENTER[0] });
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const [chartRetryBusy, setChartRetryBusy] = useState(false);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false);
  const [longPressAction, setLongPressAction] = useState<{ lat: number; lon: number; coordLabel: string } | null>(null);
  const isOffline = useIsEffectivelyOffline();
  const showScaleBar = Platform.OS === 'ios' || Device.isDevice;
  const onlineTilesAvailable = !isOffline || hasReadyPack;
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
    ],
  );

  useEffect(() => {
    configureMapLogging();
  }, []);

  useEffect(() => {
    setFollowActive(followMode);
  }, [followMode]);

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
    void applyLayerVisibility(onlineTilesAvailable);
  }, [onlineTilesAvailable, mapStyleLoaded, applyLayerVisibility]);

  useEffect(() => {
    setMapStyleLoaded(false);
  }, [chartStyleUri]);

  useMapCameraFollow({
    cameraRef,
    enabled: followActive && followMode && Boolean(fix),
    courseUp: mapCourseUp,
    followZoom: mapFollowZoom,
    fix,
  });

  async function handleMapTap(lon: number, lat: number) {
    if (mobTarget || screenLocked) return;
    const picked = nearestWaypoint(lat, lon, savedWaypoints);
    if (picked) {
      setTrackPointHit(null);
      setWaypointHit(picked.waypoint);
      return;
    }
    if (recordingTrackId && liveInspectPoints.length > 0) {
      const liveHit = nearestTrackPoint(lat, lon, liveInspectPoints);
      if (liveHit) {
        setWaypointHit(null);
        setTrackPointHit(liveHit.point);
        return;
      }
    }
    if (mapPreviewPoints.length > 0) {
      const trackHit = nearestTrackPoint(lat, lon, mapPreviewPoints);
      if (trackHit) {
        setWaypointHit(null);
        setTrackPointHit(trackHit.point);
        return;
      }
    }
    setTrackPointHit(null);
    setSeamarkLoading(true);
    try {
      const hit = (await queryNearestSeamark(lat, lon)) ?? unknownChartObject(lat, lon);
      setSeamarkHit(hit);
    } catch {
      setSeamarkHit(unknownChartObject(lat, lon));
    } finally {
      setSeamarkLoading(false);
    }
  }

  function handleLongPress(lon: number, lat: number) {
    if (screenLocked) return;
    void pulseUiAcknowledgement();
    setLongPressAction({ lat, lon, coordLabel: formatCoordinates(coordFormat, lat, lon) });
  }

  const mapOverlays = !customSelecting ? (
    <>
      <View pointerEvents="box-none" style={[styles.topOverlay, { top: mapBottom.top, left: mapBottom.left, right: mapBottom.right }]}>
        <MapTopChrome
          actionColumnWidth={mapBottom.actionColumnWidth}
          onOpenDownloads={() => navigation.navigate('Downloads')}
          onOpenSettings={() => navigation.navigate('Settings')}
          showRecenter={showRecenter}
          onRecenter={() => setFollowActive(true)}
          viewportLatitude={mapCenter.latitude}
          viewportLongitude={mapCenter.longitude}
          activityProfileId={activityProfileId}
          raceCountdown={raceCountdown}
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
    <View
      style={styles.map}
      pointerEvents={screenLocked ? 'none' : 'auto'}
      accessible
      accessibilityRole="image"
      accessibilityLabel={mapAccessibilityLabel}
      accessibilityHint={t('map.chartA11yHint')}
    >
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
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
      onRegionWillChange={() => {
        if (followMode) setFollowActive(false);
      }}
      onRegionDidChange={(e) => {
        const [lon, lat] = e.nativeEvent.center;
        setMapCenter({ latitude: lat, longitude: lon });
        if (typeof e.nativeEvent.zoom === 'number' && Number.isFinite(e.nativeEvent.zoom)) {
          setMapZoom(e.nativeEvent.zoom);
        }
      }}
      onLongPress={(e) => {
        if (customSelecting || screenLocked) return;
        const [lon, lat] = e.nativeEvent.lngLat;
        void handleLongPress(lon, lat);
      }}
      onPress={(e) => {
        if (screenLocked) return;
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
        void handleMapTap(lon, lat);
      }}
    >
      <Camera ref={cameraRef} initialViewState={{ center: KIEL_CENTER, zoom: 11 }} />
      <ExpoLocationPuck />
      <MapOverlays showRangeRings={showRangeRings} />
    </Map>
      {mapOverlays}
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
      <ResponsiveMapShell
        map={mapNode}
        panel={<MapInstruments fix={fix} embedded />}
      />

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

      {isMinimalLayout && !customSelecting && !mobTarget ? (
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
        title={t('map.dropWaypointTitle')}
        message={longPressAction?.coordLabel}
        testID="map.longPress"
        options={
          longPressAction
            ? [
                {
                  label: t('map.copyCoordsAction'),
                  testID: 'map.longPress.copy',
                  onPress: () => {
                    void Clipboard.setStringAsync(longPressAction.coordLabel).then(() => showInfo(t('map.coordsCopied')));
                  },
                },
                {
                  label: t('map.anchorHere'),
                  testID: 'map.longPress.anchor',
                  onPress: () => void activateAnchorAlarmAt(longPressAction.lat, longPressAction.lon),
                },
                {
                  label: t('map.dropWaypointConfirm'),
                  testID: 'map.longPress.waypoint',
                  onPress: () =>
                    void createWaypoint({
                      name: t('map.newWaypoint'),
                      latitude: longPressAction.lat,
                      longitude: longPressAction.lon,
                      type: 'generic',
                    }),
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

      {screenLocked ? <ScreenLockOverlay onUnlock={() => void setScreenLocked(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1, minHeight: 0, overflow: 'hidden' },
  topOverlay: { position: 'absolute', zIndex: 20 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 10 },
  hintText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  seamarkLoading: { position: 'absolute', top: '45%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
