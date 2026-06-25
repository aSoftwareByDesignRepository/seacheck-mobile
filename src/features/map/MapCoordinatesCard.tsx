import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { coordFormatTitleKey } from '../../lib/settings/coordFormats';
import { formatLatitude, formatLongitude } from '../../map/coords';
import { t } from '../../i18n';
import type { CoordFormat } from '../../settings/defaults';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  latitude: number;
  longitude: number;
  format: CoordFormat;
  stale?: boolean;
  onCopied?: () => void;
  onCycleFormat?: () => void;
};

/** Prominent lat/lon card for the Coordinates map layout. */
export function MapCoordinatesCard({ latitude, longitude, format, stale = false, onCopied, onCycleFormat }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const formatTitle = t(coordFormatTitleKey(format));
  const latText = formatLatitude(format, latitude);
  const lonText = formatLongitude(format, longitude);
  const textColor = stale ? colors.textMuted : colors.text;

  async function copyCoords() {
    await Clipboard.setStringAsync(`${latText}\n${lonText}`);
    onCopied?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.coordsCardA11y', { format: formatTitle, lat: latText, lon: lonText })}
      accessibilityHint={t('map.coordFormatCycleHint')}
      onPress={() => void copyCoords()}
      onLongPress={onCycleFormat}
      delayLongPress={400}
      style={[
        styles.card,
        {
          minHeight: minTouch,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
      testID="map.coords.card"
    >
      <View style={styles.header}>
        <Text style={[styles.formatLabel, { color: colors.textMuted }]} accessibilityRole="text">
          {formatTitle}
        </Text>
        <Text style={[styles.actionHint, { color: colors.primary }]}>{t('map.coordsTapCopy')}</Text>
      </View>
      <View style={styles.coordRows}>
        <View style={styles.coordRow}>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{t('map.latitude')}</Text>
          <Text style={[styles.coordValue, { color: textColor }]} selectable>
            {latText}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.coordRow}>
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>{t('map.longitude')}</Text>
          <Text style={[styles.coordValue, { color: textColor }]} selectable>
            {lonText}
          </Text>
        </View>
      </View>
      {stale ? (
        <Text style={[styles.staleHint, { color: colors.warningText }]} accessibilityLiveRegion="polite">
          {t('map.staleCoordsHint')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  formatLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionHint: { fontSize: 12, fontWeight: '700' },
  coordRows: { gap: 10 },
  coordRow: { gap: 4 },
  axisLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  coordValue: { fontSize: 22, fontWeight: '800', lineHeight: 30, fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth },
  staleHint: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
