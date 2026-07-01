import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useFormFactor } from '../hooks/useFormFactor';
import { resolveCoordDisplay } from '../lib/map/coordDisplayLayout';
import { COORD_FORMAT_ORDER } from '../lib/settings/coordFormats';
import { t } from '../i18n';
import { formatCoordinates } from '../map/coords';
import type { CoordFormat } from '../settings/defaults';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  latitude: number;
  longitude: number;
  onCopied?: () => void;
};

export function CoordinateBlock({ latitude, longitude, onCopied }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { instrumentCoordsSize } = useFormFactor();

  async function copyFormat(format: CoordFormat) {
    await Clipboard.setStringAsync(formatCoordinates(format, latitude, longitude));
    onCopied?.();
  }

  async function copyAll() {
    const lines = COORD_FORMAT_ORDER.map((f) => {
      const title = t(`coordinates.formats.${f}.title` as 'coordinates.formats.ddm.title');
      return `${title}: ${formatCoordinates(f, latitude, longitude)}`;
    });
    await Clipboard.setStringAsync(lines.join('\n'));
    onCopied?.();
  }

  return (
    <View style={[styles.block, { gap: spacing.sm }]} accessibilityRole="summary">
      <Text style={[styles.heading, { color: colors.textMuted }]} accessibilityRole="header">
        {t('coordinates.blockTitle')}
      </Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>{t('coordinates.blockHint')}</Text>
      {COORD_FORMAT_ORDER.map((format) => {
        const title = t(`coordinates.formats.${format}.title` as 'coordinates.formats.ddm.title');
        const display = resolveCoordDisplay(format, latitude, longitude, windowWidth);
        const value = display.layout === 'inline' ? display.inline : `${display.lat}\n${display.lon}`;
        return (
          <Pressable
            key={format}
            accessibilityRole="button"
            accessibilityLabel={t('coordinates.copyFormatA11y', { format: title, value: display.inline })}
            accessibilityHint={t('coordinates.copyHint')}
            onPress={() => void copyFormat(format)}
            style={[styles.row, { minHeight: minTouch, borderColor: colors.border, backgroundColor: colors.background }]}
            testID={`coordinates.copy.${format}`}
          >
            <Text style={[styles.formatLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {title}
            </Text>
            {display.layout === 'inline' ? (
              <Text
                style={[
                  styles.formatValue,
                  { color: colors.text, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
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
                    styles.formatValue,
                    { color: colors.text, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
                  ]}
                  numberOfLines={1}
                  selectable
                >
                  {display.lat}
                </Text>
                <Text
                  style={[
                    styles.formatValue,
                    { color: colors.text, fontSize: instrumentCoordsSize, lineHeight: instrumentCoordsSize * 1.3 },
                  ]}
                  numberOfLines={1}
                  selectable
                >
                  {display.lon}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('coordinates.copyAll')}
        onPress={() => void copyAll()}
        style={[styles.copyAll, { minHeight: minTouch, borderColor: colors.primary }]}
        testID="coordinates.copyAll"
      >
        <Text style={[styles.copyAllText, { color: colors.primary }]}>{t('coordinates.copyAll')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  heading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  row: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  formatLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  formatValue: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  stacked: { gap: 1 },
  copyAll: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  copyAllText: { fontSize: 14, fontWeight: '800' },
});
