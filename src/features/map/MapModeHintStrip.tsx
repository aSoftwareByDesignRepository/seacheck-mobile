import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';

type Props = {
  message: string;
  testID?: string;
};

/** Primary-coloured hint strip — used for passage planning / custom download modes. */
export function MapModeHintStrip({ message, testID }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.hint, { backgroundColor: colors.primary, borderColor: colors.primary }]}
      accessibilityRole="text"
      testID={testID}
    >
      <Text style={[styles.hintText, { color: colors.primaryText }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { borderWidth: 1, borderRadius: 12, padding: 10 },
  hintText: { fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '700' },
});
