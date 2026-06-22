import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  description?: string;
  first?: boolean;
};

export function SectionHeader({ title, description, first }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        {
          marginTop: first ? 0 : spacing.xl,
          marginBottom: spacing.md,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <View style={[styles.accent, { backgroundColor: colors.primary }]} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {description ? (
        <Text style={[styles.description, { color: colors.textMuted, marginLeft: spacing.md + 4 }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accent: { width: 4, height: 22, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: 0.2, flex: 1 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 6 },
});
