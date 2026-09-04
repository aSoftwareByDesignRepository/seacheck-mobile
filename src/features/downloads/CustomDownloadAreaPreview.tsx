import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CUSTOM_DOWNLOAD_OVERLAY_COLORS,
} from '../../lib/map/customDownloadOverlay';
import { boundsFromPoints } from '../../lib/map/customDownloadCorners';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { t } from '../../i18n';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useTheme } from '../../theme/ThemeContext';
import { BoundsAreaSchematic } from './BoundsAreaSchematic';

const CUSTOM_AREA_PREVIEW_HEIGHT = 140;

/**
 * Custom-area preview shown in the Map-tab download panel.
 * Uses a non-MapLibre schematic so it never fights NavigationMap for Android's
 * single reliable GL surface — the live outline stays on the main chart.
 */
export function CustomDownloadAreaPreview() {
  const { colors, minTouch } = useTheme();
  const corners = useCustomDownloadStore((s) => s.corners);
  const bounds = useMemo(() => boundsFromPoints(corners), [corners]);
  const height = Math.max(CUSTOM_AREA_PREVIEW_HEIGHT, minTouch);

  if (corners.length === 0) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            minHeight: height,
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
      <BoundsAreaSchematic
        corners={corners}
        bounds={bounds}
        height={height}
        fillColor={CUSTOM_DOWNLOAD_OVERLAY_COLORS.fill}
        lineColor={CUSTOM_DOWNLOAD_OVERLAY_COLORS.line}
        backgroundColor={colors.surface}
        borderColor={colors.border}
        testID="downloads.custom.areaPreview"
      />
      <Text style={[styles.hint, { color: colors.textMuted }]} accessibilityRole="text">
        {t('downloads.customAreaPreviewA11y', { count: corners.length })}
      </Text>
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
  hint: { fontSize: 13, lineHeight: 18 },
  placeholder: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    justifyContent: 'center',
    minHeight: MAP_EMBED_PREVIEW_HEIGHT,
  },
  placeholderText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
