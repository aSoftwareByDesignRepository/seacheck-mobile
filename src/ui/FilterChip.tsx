import { Pressable, Text } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { filterChipStyle, filterChipText } from './chipTokens';

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
        filterChipStyle(minTouch),
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[filterChipText, { color: selected ? colors.primaryText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}
