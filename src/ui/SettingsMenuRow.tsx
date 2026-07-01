import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  hint?: string;
  onPress: () => void;
  testID?: string;
  first?: boolean;
};

export function SettingsMenuRow({ label, hint, onPress, testID, first }: Props) {
  const { colors, minTouch } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTouch,
          borderTopColor: colors.border,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} accessibilityElementsHidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 18 },
});
