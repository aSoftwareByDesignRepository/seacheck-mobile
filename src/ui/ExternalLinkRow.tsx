import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  url: string;
  testID?: string;
};

export function ExternalLinkRow({ label, url, testID }: Props) {
  const { colors, minTouch } = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={url}
      onPress={() => void Linking.openURL(url)}
      testID={testID}
      style={({ pressed }) => [styles.row, { minHeight: minTouch, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
