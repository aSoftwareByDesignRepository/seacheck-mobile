import { Pressable, StyleSheet, Text } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export function FilterChip({ label, selected, onPress, testID }: Props) {
  const { colors, minTouch } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint={selected ? t('common.filterSelectedHint') : t('common.filterUnselectedHint')}
      onPress={onPress}
      style={[
        styles.chip,
        {
          minHeight: minTouch,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: selected ? colors.primaryText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  text: { fontSize: 14, fontWeight: '700' },
});
