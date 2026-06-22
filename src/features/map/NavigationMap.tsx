import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Camera,
  Map,
  UserLocation,
  type MapRef,
  type TrackUserLocation,
} from '@maplibre/maplibre-react-native';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlarmMonitor } from '../../services/alarmMonitor';
import { CustomDownloadMapPanel } from '../downloads/CustomDownloadMapPanel';
import { ResponsiveMapShell } from '../responsive/ResponsiveMapShell';
import { KIEL_CENTER } from '../../map/constants';
import { formatCoordinates } from '../../map/coords';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useLocationStore } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { MapChrome } from './MapChrome';
import { MapInstruments } from './MapInstruments';
import { MapOfflineBanner } from './MapOfflineBanner';
import { MapOverlays } from './MapOverlays';

export function NavigationMap() {
  useAlarmMonitor();

  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const followMode = useSettingsStore((s) => s.followMode);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const layoutPreset = useSettingsStore((s) => s.layoutPreset);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const hasReadyPack = useOfflinePackStore((s) => s.hasReadyPack());
  const createWaypoint = useWaypointStore((s) => s.create);
  const setAnchorAlarm = useNavigationStore((s) => s.setAnchorAlarm);
  const fix = useLocationStore((s) => s.fix);
  const startWatching = useLocationStore((s) => s.startWatching);
  const stopWatching = useLocationStore((s) => s.stopWatching);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const setCustomCorner = useCustomDownloadStore((s) => s.setCorner);
  const [showBase, setShowBase] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(false);
  const [followActive, setFollowActive] = useState(followMode);

  useEffect(() => {
    setFollowActive(followMode);
  }, [followMode]);

  useEffect(() => {
    if (!keepAwakeUnderway) {
      void deactivateKeepAwake('seacheck-navigation');
      return;
    }
    void activateKeepAwake('seacheck-navigation');
    return () => {
      void deactivateKeepAwake('seacheck-navigation');
    };
  }, [keepAwakeUnderway]);

  useEffect(() => {
    void startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  const applyLayerVisibility = useCallback(async (base: boolean, seamarks: boolean) => {
    try {
      await mapRef.current?.setSourceVisibility(base, 'carto-base');
      await mapRef.current?.setSourceVisibility(seamarks, 'openseamap-seamarks');
    } catch {
      /* map not ready */
    }
  }, []);

  useEffect(() => {
    void applyLayerVisibility(showBase, showSeamarks);
  }, [showBase, showSeamarks, chartStyleUri, applyLayerVisibility]);

  const trackUserLocation: TrackUserLocation | undefined =
    followActive && followMode ? (mapCourseUp ? 'course' : 'default') : undefined;

  async function handleLongPress(lon: number, lat: number) {
    const coordLabel = formatCoordinates(coordFormat, lat, lon);
    Alert.alert(t('map.dropWaypointTitle'), coordLabel, [
      { text: t('common.dismiss'), style: 'cancel' },
      {
        text: t('map.copyCoordsAction'),
        onPress: () => {
          void Clipboard.setStringAsync(coordLabel).then(() => showInfo(t('map.coordsCopied')));
        },
      },
      {
        text: t('map.anchorHere'),
        onPress: () => void setAnchorAlarm(lat, lon, 0.05),
      },
      {
        text: t('map.dropWaypointConfirm'),
        onPress: () => void createWaypoint({ name: t('map.newWaypoint'), latitude: lat, longitude: lon, type: 'generic' }),
      },
    ]);
  }

  const mapNode = chartStyleUri ? (
    <Map
      ref={mapRef}
      style={styles.map}
      mapStyle={chartStyleUri}
      attribution
      attributionPosition={{ bottom: layoutPreset === 'map-forward' ? 120 + insets.bottom : 8, right: 8 }}
      compass
      compassPosition={{ top: insets.top + 8, right: 8 }}
      scaleBar
      scaleBarPosition={{ top: insets.top + 8, left: 8 }}
      onRegionWillChange={() => {
        if (followMode) setFollowActive(false);
      }}
      onLongPress={(e) => {
        if (customSelecting) return;
        const [lon, lat] = e.nativeEvent.lngLat;
        void handleLongPress(lon, lat);
      }}
      onPress={(e) => {
        if (!customSelecting) return;
        const [lon, lat] = e.nativeEvent.lngLat;
        const state = useCustomDownloadStore.getState();
        setCustomCorner({ latitude: lat, longitude: lon });
        if (!state.cornerA) {
          showInfo(t('downloads.customCornerFirst'));
        } else if (!state.cornerB) {
          showInfo(t('downloads.customCornerSet'));
        } else {
          showInfo(t('downloads.customCornerReset'));
        }
      }}
    >
      <Camera
        initialViewState={{ center: KIEL_CENTER, zoom: 11 }}
        {...(trackUserLocation ? { trackUserLocation, zoom: 13 } : {})}
      />
      <UserLocation animated accuracy heading />
      <MapOverlays showRangeRings={showRangeRings} />
    </Map>
  ) : (
    <View style={[styles.map, { backgroundColor: colors.background }]} />
  );

  return (
    <View style={styles.root} testID="screen.map">
      <ResponsiveMapShell
        map={mapNode}
        panel={<MapInstruments fix={fix} embedded={layoutPreset !== 'map-forward'} />}
      />

      <View pointerEvents="box-none" style={[styles.topOverlay, { top: insets.top + spacing.sm }]}>
        {customSelecting ? (
          <View style={[styles.hint, { backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.sm }]}>
            <Text style={[styles.hintText, { color: colors.primaryText, fontWeight: '700' }]}>{t('downloads.customMapBanner')}</Text>
          </View>
        ) : null}
        {!customSelecting && !hasReadyPack ? (
          <View style={[styles.hint, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.sm }]}>
            <Text style={[styles.hintText, { color: colors.textMuted }]}>{t('map.downloadHint')}</Text>
          </View>
        ) : null}
        {!customSelecting ? <MapOfflineBanner onOpenDownloads={() => navigation.navigate('Downloads')} /> : null}
        {!customSelecting ? (
          <View style={styles.layers}>
            <LayerChip label={t('map.layerBase')} active={showBase} onPress={() => setShowBase((v) => !v)} colors={colors} minTouch={minTouch} testID="map.layer.base" />
            <LayerChip label={t('map.layerSeamarks')} active={showSeamarks} onPress={() => setShowSeamarks((v) => !v)} colors={colors} minTouch={minTouch} testID="map.layer.seamarks" />
          </View>
        ) : null}
      </View>

      {!customSelecting ? <MapChrome showRangeRings={showRangeRings} onToggleRangeRings={() => setShowRangeRings((v) => !v)} /> : null}
      {customSelecting ? <CustomDownloadMapPanel /> : null}

      {followMode && !followActive && !customSelecting ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
          onPress={() => setFollowActive(true)}
          style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 140, minHeight: minTouch, minWidth: minTouch }]}
          testID="map.recenter"
        >
          <Text style={[styles.fabText, { color: colors.primaryText }]}>{t('map.recenter')}</Text>
        </Pressable>
      ) : null}

      {layoutPreset === 'map-forward' && !customSelecting ? <MapInstruments fix={fix} /> : null}
    </View>
  );
}

function LayerChip({
  label,
  active,
  onPress,
  colors,
  minTouch,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: { primary: string; primaryText: string; surface: string; border: string; text: string };
  minTouch: number;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { minHeight: minTouch, backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.chipText, { color: active ? colors.primaryText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#b8d4e8' },
  map: { flex: 1 },
  topOverlay: { position: 'absolute', left: 12, right: 12 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 10 },
  hintText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  layers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  fab: { position: 'absolute', alignSelf: 'center', borderRadius: 999, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 15, fontWeight: '700' },
});
