import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { useTheme } from '../theme/ThemeContext';

export function GlobalFeedback() {
  const message = useFeedbackStore((s) => s.message);
  const kind = useFeedbackStore((s) => s.kind);
  const clear = useFeedbackStore((s) => s.clear);
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  if (!message || !kind) return null;

  const palette =
    kind === 'error'
      ? { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger }
      : kind === 'info'
        ? { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningText }
        : { bg: colors.successBg, border: colors.border, text: colors.success };

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.xs }]}>
      <View
        testID="feedback.banner"
        style={[styles.wrap, { backgroundColor: palette.bg, borderColor: palette.border, marginHorizontal: spacing.lg }]}
        accessibilityRole="alert"
        accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      >
        <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
        {kind === 'error' ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            style={[styles.dismiss, { minHeight: minTouch }]}
          >
            <Text style={[styles.dismissText, { color: palette.text }]}>{t('common.dismiss')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, elevation: 8 },
  wrap: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  text: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center' },
  dismiss: { marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});
