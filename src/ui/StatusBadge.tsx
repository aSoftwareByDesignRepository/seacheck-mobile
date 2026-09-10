import { Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Variant = 'success' | 'warning' | 'danger' | 'neutral';

type Props = {
  label: string;
  variant?: Variant;
  testID?: string;
};

/**
 * Soft status well (COMPANION-DESIGN-SYSTEM §5): tinted *Bg/*Border + label + status dot.
 * Not an outline-on-surface pill.
 */
export function StatusBadge({ label, variant = 'neutral', testID }: Props) {
  const { colors } = useTheme();
  const palette =
    variant === 'success'
      ? { bg: colors.successBg, text: colors.success, border: colors.successBorder, dot: colors.success }
      : variant === 'warning'
        ? { bg: colors.warningBg, text: colors.warningText, border: colors.warningBorder, dot: colors.trafficYellow }
        : variant === 'danger'
          ? { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder, dot: colors.danger }
          : { bg: colors.neutralBg, text: colors.textMuted, border: colors.neutralBorder, dot: colors.textSubtle };

  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.dot }}
        importantForAccessibility="no"
      />
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>{label}</Text>
    </View>
  );
}
