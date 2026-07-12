import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';

import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { useFormFactor } from '../../hooks/useFormFactor';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import { buildPlanningPassageGeoJson } from '../map/MapOverlays';
import { KIEL_CENTER } from '../../map/constants';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  waypoints: WaypointRow[];
  /** Taller preview for tablet split pane. */
  tall?: boolean;
};

export function PassageMapPreview({ waypoints, tall = false }: Props) {
  const { colors, minTouch } = useTheme();
  const { width, height } = useFormFactor();
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const exclusiveChartDownload = useExclusiveChartDownloadSession();
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const previewHeight = tall ? Math.max(MAP_EMBED_PREVIEW_HEIGHT, Math.round(Math.min(width, height) * 0.42)) : MAP_EMBED_PREVIEW_HEIGHT;
  const bounds = useMemo(() => boundsFromWaypoints(waypoints), [waypoints]);
  const geojson = useMemo(
    () => buildPlanningPassageGeoJson(waypoints.map((wp) => ({ id: wp.id, longitude: wp.longitude, latitude: wp.latitude }))),
    [waypoints],
  );
  const mapKey = `passage-preview-${width}x${height}-${waypoints.map((wp) => wp.id).join('-')}`;

  useEffect(() => {
    setReady(false);
  }, [chartStyleUri, mapKey]);

  useEffect(() => {
    if (!ready || !bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding: { top: 28, right: 28, bottom: 28, left: 28 }, duration: 0 });
  }, [ready, bounds, waypoints]);

  if (waypoints.length === 0) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch }]}
        accessibilityRole="text"
      >
        <Text style={[styles.placeholderBody, { color: colors.textMuted }]}>{t('passage.waypointsEmpty')}</Text>
      </View>
    );
  }

  if (!chartStyleUri || exclusiveChartDownload) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: previewHeight }]}
        accessibilityRole="summary"
        accessibilityLabel={exclusiveChartDownload ? t('downloads.statusSummaryActiveTitle') : t('passage.mapPreviewOffline')}
      >
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>
          {exclusiveChartDownload ? t('downloads.statusSummaryActiveTitle') : t('downloads.previewUnavailableTitle')}
        </Text>
        <Text style={[styles.placeholderBody, { color: colors.textMuted }]}>
          {exclusiveChartDownload ? t('downloads.statusSummaryActiveHint') : t('passage.mapPreviewOffline')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.wrap, { height: previewHeight, minHeight: Math.max(previewHeight, minTouch) }]}
      testID="passage.mapPreview"
      accessibilityLabel={t('passage.mapPreviewTitle')}
    >
      <Map
        key={Platform.OS === 'android' ? mapKey : `passage-preview-${waypoints.length}`}
        style={styles.map}
        mapStyle={chartStyleUri}
        onDidFinishLoadingMap={() => setReady(true)}
      >
        <Camera ref={cameraRef} initialViewState={{ center: KIEL_CENTER, zoom: 8 }} />
        <GeoJSONSource id="passage-preview-route" data={geojson}>
          <Layer
            id="passage-preview-line"
            type="line"
            filter={['==', ['get', 'kind'], 'planning-leg']}
            paint={{ 'line-color': '#0073ad', 'line-width': 3, 'line-opacity': 0.9 }}
          />
          <Layer
            id="passage-preview-wp"
            type="circle"
            filter={['==', ['get', 'kind'], 'planning-wp']}
            paint={{
              'circle-radius': 7,
              'circle-color': '#e65100',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFill },
  placeholder: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: { fontSize: 16, fontWeight: '700' },
  placeholderBody: { fontSize: 14, lineHeight: 20 },
});
