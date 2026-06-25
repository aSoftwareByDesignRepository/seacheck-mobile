import { Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { statusBadgeStyle, statusBadgeText } from './chipTokens';

type Variant = 'success' | 'warning' | 'danger' | 'neutral';

type Props = {
  label: string;
  variant?: Variant;
};

export function StatusBadge({ label, variant = 'neutral' }: Props) {
  const { colors } = useTheme();
  const palette =
    variant === 'success'
      ? { bg: colors.successBg, text: colors.success, border: colors.success }
      : variant === 'warning'
        ? { bg: colors.warningBg, text: colors.warningText, border: colors.warningBorder }
        : variant === 'danger'
          ? { bg: colors.dangerBg, text: colors.danger, border: colors.dangerBorder }
          : { bg: colors.surface, text: colors.textMuted, border: colors.border };

  return (
    <View
      style={[statusBadgeStyle(), { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="text"
    >
      <Text style={[statusBadgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}
