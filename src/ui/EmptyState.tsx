import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function EmptyState({ icon, title, body, actionLabel, onAction, testID }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View testID={testID} style={[styles.wrap, { padding: spacing.xl }]} accessibilityRole="text">
      <MaterialIcons name={icon} size={48} color={colors.textMuted} accessibilityElementsHidden />
      <Text style={[styles.title, { color: colors.text, marginTop: spacing.lg }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted, marginTop: spacing.sm }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: spacing.lg }} testID={`${testID}.action`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
});
