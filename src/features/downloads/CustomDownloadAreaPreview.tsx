import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  buildCustomDownloadOverlayGeoJson,
  CUSTOM_DOWNLOAD_OVERLAY_COLORS,
  customDownloadOverlaySourceKey,
} from '../../lib/map/customDownloadOverlay';
import { boundsFromPoints } from '../../lib/map/customDownloadCorners';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { t } from '../../i18n';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useTheme } from '../../theme/ThemeContext';
import { EmbeddedChartMap } from '../map/EmbeddedChartMap';

const CUSTOM_AREA_PREVIEW_HEIGHT = 140;

export function CustomDownloadAreaPreview() {
  const { colors, minTouch } = useTheme();
  const corners = useCustomDownloadStore((s) => s.corners);
  const bounds = useMemo(() => boundsFromPoints(corners), [corners]);
  const sourceKey = useMemo(() => customDownloadOverlaySourceKey(corners), [corners]);
  const geojson = useMemo(
    () => buildCustomDownloadOverlayGeoJson({ corners, showEdgePreview: true }),
    [corners],
  );

  if (corners.length === 0) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            minHeight: Math.max(CUSTOM_AREA_PREVIEW_HEIGHT, minTouch),
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        accessibilityRole="text"
      >
        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
          {t('downloads.customAreaPreviewEmpty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('downloads.customAreaPreviewTitle')}>
      <Text style={[styles.label, { color: colors.textMuted }]} accessibilityRole="header">
        {t('downloads.customAreaPreviewTitle')}
      </Text>
      <EmbeddedChartMap
        mapKey={`custom-area-preview-${sourceKey}`}
        height={CUSTOM_AREA_PREVIEW_HEIGHT}
        minHeight={Math.max(CUSTOM_AREA_PREVIEW_HEIGHT, minTouch)}
        fitBounds={bounds}
        fitPadding={{ top: 20, right: 20, bottom: 20, left: 20 }}
        testID="downloads.custom.areaPreview"
        accessibilityLabel={t('downloads.customAreaPreviewA11y', { count: corners.length })}
        placeholder={
          <View
            style={[
              styles.placeholder,
              {
                minHeight: CUSTOM_AREA_PREVIEW_HEIGHT,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              {t('passage.mapPreviewOffline')}
            </Text>
          </View>
        }
      >
        <GeoJSONSource id="custom-area-preview" data={geojson}>
          <Layer
            id="custom-area-preview-edge"
            type="line"
            filter={['in', ['get', 'kind'], ['literal', ['custom-download-edge', 'custom-download-edge-preview']]]}
            paint={{
              'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.line,
              'line-width': 3,
              'line-opacity': 1,
            }}
          />
          <Layer
            id="custom-area-preview-fill"
            type="fill"
            filter={['in', ['get', 'kind'], ['literal', ['custom-download', 'custom-download-preview']]]}
            paint={{
              'fill-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.fill,
              'fill-opacity': 0.3,
            }}
          />
          <Layer
            id="custom-area-preview-line"
            type="line"
            filter={['in', ['get', 'kind'], ['literal', ['custom-download', 'custom-download-preview']]]}
            paint={{
              'line-color': CUSTOM_DOWNLOAD_OVERLAY_COLORS.line,
              'line-width': 3,
              'line-opacity': 1,
            }}
          />
        </GeoJSONSource>
      </EmbeddedChartMap>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  placeholder: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    justifyContent: 'center',
    minHeight: MAP_EMBED_PREVIEW_HEIGHT,
  },
  placeholderText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
