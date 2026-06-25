import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COORD_FORMAT_EXAMPLE, COORD_FORMAT_ORDER } from '../lib/settings/coordFormats';
import { formatCoordinates } from '../map/coords';
import { t } from '../i18n';
import type { CoordFormat } from '../settings/defaults';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  value: CoordFormat;
  onChange: (format: CoordFormat) => void;
};

/** Accessible radio list — plain-language coordinate formats with a live example each. */
export function CoordFormatPicker({ value, onChange }: Props) {
  const { colors, spacing, minTouch } = useTheme();

  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('settings.coordFormat')}>
      {COORD_FORMAT_ORDER.map((format) => {
        const selected = value === format;
        const example = formatCoordinates(format, COORD_FORMAT_EXAMPLE.latitude, COORD_FORMAT_EXAMPLE.longitude);
        const title = t(`coordinates.formats.${format}.title` as 'coordinates.formats.ddm.title');
        const description = t(`coordinates.formats.${format}.description` as 'coordinates.formats.ddm.description');
        const recommended = format === 'ddm';

        return (
          <Pressable
            key={format}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${title}. ${description}. ${t('coordinates.exampleLabel')}: ${example}`}
            onPress={() => onChange(format)}
            style={[
              styles.option,
              {
                minHeight: minTouch,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.successBg : colors.background,
              },
            ]}
            testID={`settings.coord.${format}`}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                {recommended ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.badgeText, { color: colors.primaryText }]}>{t('coordinates.formats.ddm.recommended')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
              <Text style={[styles.example, { color: colors.text }]} selectable>
                {example}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  textCol: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  description: { fontSize: 14, lineHeight: 20 },
  example: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], lineHeight: 20, marginTop: 2 },
});
