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

/** Compact coordinates — one line when width allows; tap copy, long-press cycle format. */
export function InstrumentCoordsLine({
  latitude,
  longitude,
  format,
  stale = false,
  onCopied,
  onCycleFormat,
}: Props) {
  const { colors, minTouch, spacing } = useTheme();
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
        styles.shell,
        {
          minHeight: minTouch,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
      ]}
      testID="map.coords.line"
    >
      <View style={[styles.header, { gap: spacing.sm }]}>
        <Text style={[styles.format, { color: colors.textMuted }]} numberOfLines={1}>
          {formatTitle}
        </Text>
        <Text style={[styles.hint, { color: colors.primary }]} numberOfLines={1}>
          {t('map.coordsTapCopy')}
        </Text>
      </View>

      {display.layout === 'inline' ? (
        <Text
          style={[
            styles.coords,
            { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
          ]}
          numberOfLines={2}
          testID="map.coords.inline"
        >
          {display.inline}
        </Text>
      ) : (
        <View style={styles.stacked} testID="map.coords.stacked">
          <Text
            style={[
              styles.coords,
              { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
            ]}
            numberOfLines={1}
          >
            {display.lat}
          </Text>
          <Text
            style={[
              styles.coords,
              { color: textColor, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
            ]}
            numberOfLines={1}
          >
            {display.lon}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderRadius: 14, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 },
  format: { flexShrink: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { flexShrink: 0, fontSize: 11, fontWeight: '700' },
  coords: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  stacked: { gap: 1 },
});
