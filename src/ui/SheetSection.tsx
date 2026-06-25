import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import { radius, typography } from '../theme/tokens';

type SectionProps = PropsWithChildren<{
  label: string;
  first?: boolean;
}>;

/** Grouped block inside a bottom sheet — overline label + content. */
export function SheetSection({ label, first = false, children }: SectionProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ marginTop: first ? 0 : spacing.lg, gap: spacing.sm }}>
      <Text style={[styles.overline, { color: colors.textMuted }]} accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  );
}

type MenuRowProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  testID?: string;
};

/** Tappable row with optional icon — tab overflow, settings-style menus. */
export function SheetMenuRow({ label, onPress, selected = false, icon, testID }: MenuRowProps) {
  const { colors, minTouch } = useTheme();

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        {
          minHeight: minTouch,
          backgroundColor: selected ? colors.successBg : colors.background,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      testID={testID}
    >
      {icon ? (
        <MaterialIcons name={icon} size={24} color={selected ? colors.primary : colors.textMuted} accessibilityElementsHidden />
      ) : null}
      <Text style={[styles.menuLabel, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
      {selected ? (
        <MaterialIcons name="check" size={22} color={colors.primary} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overline: { ...typography.overline },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 22 },
});
