import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection } from 'geojson';

import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import type { RegionPackDefinition } from '../../map/regionPacks';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { EmbeddedChartMap } from '../map/EmbeddedChartMap';

type Props = {
  pack: RegionPackDefinition;
};

export function RegionPackMapPreview({ pack }: Props) {
  const { colors, minTouch } = useTheme();
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const exclusiveChartDownload = useExclusiveChartDownloadSession();
  const [west, south, east, north] = pack.bounds;

  const geojson = useMemo(
    (): FeatureCollection => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'pack-bounds' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
          },
        } satisfies Feature,
      ],
    }),
    [west, south, east, north],
  );

  const placeholder = (
    <View
      style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
      mapKey={`pack-preview-${pack.id}`}
      height={MAP_EMBED_PREVIEW_HEIGHT}
      minHeight={Math.max(MAP_EMBED_PREVIEW_HEIGHT, minTouch)}
      fitBounds={pack.bounds}
      fitPadding={{ top: 24, right: 24, bottom: 24, left: 24 }}
      testID="downloads.packPreview"
      accessibilityLabel={t('downloads.previewTitle')}
      placeholder={placeholder}
    >
      <GeoJSONSource id={`pack-preview-${pack.id}`} data={geojson}>
        <Layer id={`pack-preview-fill-${pack.id}`} type="fill" paint={{ 'fill-color': '#0073ad', 'fill-opacity': 0.18 }} />
        <Layer id={`pack-preview-line-${pack.id}`} type="line" paint={{ 'line-color': '#0073ad', 'line-width': 3 }} />
      </GeoJSONSource>
    </EmbeddedChartMap>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: MAP_EMBED_PREVIEW_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  placeholderTitle: { fontSize: 16, fontWeight: '700' },
  placeholderBody: { fontSize: 14, lineHeight: 20 },
});
