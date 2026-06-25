import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, typography } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  options: ActionSheetOption[];
  testID?: string;
};

export function ActionSheet({ visible, onClose, title, message, options, testID }: Props) {
  const { colors, spacing, minTouch } = useTheme();

  function run(option: ActionSheetOption) {
    onClose();
    option.onPress();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={message} testID={testID}>
      <View style={{ gap: spacing.sm }}>
        {options.map((option) => (
          <Pressable
            key={option.testID ?? option.label}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => run(option)}
            style={({ pressed }) => [
              styles.option,
              {
                minHeight: minTouch,
                backgroundColor: option.destructive ? colors.dangerBg : colors.background,
                borderColor: option.destructive ? colors.dangerBorder : colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            testID={option.testID}
          >
            <Text style={[styles.optionLabel, { color: option.destructive ? colors.danger : colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { ...typography.body, fontWeight: '600', textAlign: 'center' },
});
