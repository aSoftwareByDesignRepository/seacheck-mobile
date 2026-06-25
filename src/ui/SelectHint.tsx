import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = PropsWithChildren<{
  testID?: string;
}>;

/** Empty master–detail pane — consistent spacing and readable hint text. */
export function SelectHint({ children, testID }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.box,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: spacing.lg,
        },
      ]}
      accessibilityRole="text"
    >
      <Text style={[styles.text, { color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 120,
    justifyContent: 'center',
  },
  text: { textAlign: 'center', lineHeight: 22, fontSize: 15 },
});
