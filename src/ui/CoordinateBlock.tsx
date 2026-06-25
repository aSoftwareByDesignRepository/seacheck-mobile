import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        const value = formatCoordinates(format, latitude, longitude);
        return (
          <Pressable
            key={format}
            accessibilityRole="button"
            accessibilityLabel={t('coordinates.copyFormatA11y', { format: title, value })}
            accessibilityHint={t('coordinates.copyHint')}
            onPress={() => void copyFormat(format)}
            style={[styles.row, { minHeight: minTouch, borderColor: colors.border, backgroundColor: colors.background }]}
            testID={`coordinates.copy.${format}`}
          >
            <Text style={[styles.formatLabel, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.formatValue, { color: colors.text }]} selectable>
              {value}
            </Text>
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
  row: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  formatLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  formatValue: { fontSize: 14, fontWeight: '600', lineHeight: 20, fontVariant: ['tabular-nums'] },
  copyAll: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  copyAllText: { fontSize: 14, fontWeight: '800' },
});
