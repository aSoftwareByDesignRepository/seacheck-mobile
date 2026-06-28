import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import type { LayoutPreset } from '../settings/defaults';
import { LAYOUT_PRESETS } from '../settings/profiles';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  value: LayoutPreset;
  onChange: (preset: LayoutPreset) => void;
  testIDPrefix?: string;
};

/** Map layout presets — short label and description side by side for clarity. */
export function LayoutPresetPicker({ value, onChange, testIDPrefix = 'settings.layout' }: Props) {
  const { colors, spacing, minTouch } = useTheme();

  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      {LAYOUT_PRESETS.map((preset) => {
        const selected = value === preset;
        const title = t(`map.layouts.${preset}` as 'map.layouts.map-forward');
        const description = t(`settings.layoutDescriptions.${preset}` as 'settings.layoutDescriptions.map-forward');

        return (
          <Pressable
            key={preset}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${title}. ${description}`}
            onPress={() => onChange(preset)}
            style={({ pressed }) => [
              styles.option,
              {
                minHeight: minTouch,
                backgroundColor: selected ? colors.successBg : colors.background,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            testID={`${testIDPrefix}.${preset}`}
          >
            <View style={styles.titleCol}>
              <Text style={[styles.title, { color: selected ? colors.primary : colors.text }]} numberOfLines={2}>
                {title}
              </Text>
            </View>
            <View style={styles.descCol}>
              <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
            </View>
            {selected ? (
              <Text style={[styles.check, { color: colors.primary }]} accessibilityElementsHidden importantForAccessibility="no">
                ✓
              </Text>
            ) : null}
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
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleCol: { width: 96, flexShrink: 0, paddingTop: 1 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  descCol: { flex: 1, minWidth: 0 },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  check: { fontSize: 18, fontWeight: '800', lineHeight: 22, marginTop: 1 },
});
