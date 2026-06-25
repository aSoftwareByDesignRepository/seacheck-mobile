import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { radius, typography } from '../theme/tokens';
import { Button } from './Button';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

/** Inline two-step confirm inside an open sheet (avoids modal-on-modal). */
export function ConfirmPanel({ title, message, confirmLabel, onConfirm, onCancel, testID }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[styles.panel, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, gap: spacing.md }]}
      accessibilityRole="alert"
      testID={testID}
    >
      <Text style={[styles.title, { color: colors.danger }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      <View style={{ gap: spacing.sm }}>
        <Button label={confirmLabel} variant="danger" onPress={onConfirm} testID={testID ? `${testID}.confirm` : undefined} />
        <Button label={t('common.dismiss')} variant="ghost" onPress={onCancel} testID={testID ? `${testID}.cancel` : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 16 },
  title: { ...typography.body, fontWeight: '800' },
  message: { ...typography.body },
});
