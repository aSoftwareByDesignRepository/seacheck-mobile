import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { useFormFactor } from '../../hooks/useFormFactor';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import { buildPlanningPassageGeoJson } from '../map/MapOverlays';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { EmbeddedChartMap } from '../map/EmbeddedChartMap';

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
  const previewHeight = tall ? Math.max(MAP_EMBED_PREVIEW_HEIGHT, Math.round(Math.min(width, height) * 0.42)) : MAP_EMBED_PREVIEW_HEIGHT;
  const bounds = useMemo(() => boundsFromWaypoints(waypoints), [waypoints]);
  const geojson = useMemo(
    () => buildPlanningPassageGeoJson(waypoints.map((wp) => ({ id: wp.id, longitude: wp.longitude, latitude: wp.latitude }))),
    [waypoints],
  );
  const mapKey =
    Platform.OS === 'android'
      ? `passage-preview-${width}x${height}-${waypoints.map((wp) => wp.id).join('-')}`
      : `passage-preview-${waypoints.length}`;

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

  const placeholder = (
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

  if (!chartStyleUri || exclusiveChartDownload) {
    return placeholder;
  }

  return (
    <EmbeddedChartMap
      mapKey={mapKey}
      height={previewHeight}
      minHeight={Math.max(previewHeight, minTouch)}
      fitBounds={bounds}
      fitPadding={{ top: 28, right: 28, bottom: 28, left: 28 }}
      testID="passage.mapPreview"
      accessibilityLabel={t('passage.mapPreviewTitle')}
      placeholder={placeholder}
    >
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
    </EmbeddedChartMap>
  );
}

const styles = StyleSheet.create({
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
