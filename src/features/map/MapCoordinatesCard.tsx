import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { resolveCoordDisplay } from '../../lib/map/coordDisplayLayout';
import { coordFormatTitleKey } from '../../lib/settings/coordFormats';
import { formatCoordinates } from '../../map/coords';
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

/** Standalone coordinates card — same compact layout as InstrumentCoordsLine. */
export function MapCoordinatesCard({ latitude, longitude, format, stale = false, onCopied, onCycleFormat }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { instrumentCoordsSize } = useFormFactor();
  const formatTitle = t(coordFormatTitleKey(format));
  const display = resolveCoordDisplay(format, latitude, longitude, windowWidth);
  const textColor = stale ? colors.textMuted : colors.text;

  async function copyCoords() {
    await Clipboard.setStringAsync(formatCoordinates(format, latitude, longitude));
    onCopied?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.coordsCardA11y', { format: formatTitle, lat: display.lat, lon: display.lon })}
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
          gap: spacing.xs,
        },
      ]}
      testID="map.coords.card"
    >
      <View style={[styles.header, { gap: spacing.sm }]}>
        <Text style={[styles.formatLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {formatTitle}
        </Text>
        <Text style={[styles.actionHint, { color: colors.primary }]} numberOfLines={1}>
          {t('map.coordsTapCopy')}
        </Text>
      </View>

      {display.layout === 'inline' ? (
        <Text
          style={[
            styles.coordValue,
            { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
          ]}
          numberOfLines={2}
          selectable
        >
          {display.inline}
        </Text>
      ) : (
        <View style={styles.stacked}>
          <Text
            style={[
              styles.coordValue,
              { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
            ]}
            numberOfLines={1}
            selectable
          >
            {display.lat}
          </Text>
          <Text
            style={[
              styles.coordValue,
              { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
            ]}
            numberOfLines={1}
            selectable
          >
            {display.lon}
          </Text>
        </View>
      )}

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 },
  formatLabel: { flexShrink: 1, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionHint: { flexShrink: 0, fontSize: 12, fontWeight: '700' },
  coordValue: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  stacked: { gap: 1 },
  staleHint: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
