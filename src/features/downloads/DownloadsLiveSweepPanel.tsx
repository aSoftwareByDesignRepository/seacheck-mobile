import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { useTheme } from '../../theme/ThemeContext';
import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';

/**
 * Downloads-tab notice while the Map tab hosts the exclusive sweep GL surface.
 * Does not mount MapLibre — remounting here would orphan the tile sweep.
 */
export function DownloadsLiveSweepPanel() {
  const exclusive = useExclusiveChartDownloadSession();
  const { colors, spacing, minTouch } = useTheme();

  if (!exclusive) return null;

  const height = Math.max(MAP_EMBED_PREVIEW_HEIGHT, minTouch * 2);

  return (
    <View
      style={[styles.section, { gap: spacing.sm, marginBottom: spacing.md }]}
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.liveSweepA11y')}
      testID="downloads.liveSweepPanel"
    >
      <Text style={[styles.label, { color: colors.textMuted }]} accessibilityRole="header">
        {t('downloads.liveSweepTitle')}
      </Text>
      <View
        style={[
          styles.mapFrame,
          {
            height,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing.md,
            justifyContent: 'center',
          },
        ]}
        collapsable={false}
        testID="downloads.liveSweepPanel.deferred"
      >
        <Text style={[styles.hint, { color: colors.text }]}>{t('downloads.liveSweepDeferred')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted, marginTop: spacing.sm }]}>
          {t('downloads.liveSweepHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mapFrame: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  hint: { fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
});
