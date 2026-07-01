import { useCallback, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useDownloadFailureStore } from '../store/downloadFailureStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

export function DownloadFailureModal() {
  const { visible, title, summary, report, dismiss } = useDownloadFailureStore();
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!report) return;
    await Clipboard.setStringAsync(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [report]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.dangerBorder,
              padding: spacing.lg,
              gap: spacing.md,
              maxHeight: '92%',
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.danger }]} accessibilityRole="alert">
            {title}
          </Text>
          <Text style={{ color: colors.text, lineHeight: 24, fontSize: 16 }}>{summary}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{t('downloads.failureModal.reportHint')}</Text>
          <ScrollView
            style={[styles.reportScroll, { borderColor: colors.border, backgroundColor: colors.background }]}
            nestedScrollEnabled
            accessibilityLabel={t('downloads.failureModal.reportLabel')}
          >
            <TextInput
              value={report}
              multiline
              editable={false}
              selectTextOnFocus
              showSoftInputOnFocus={false}
              scrollEnabled={false}
              accessibilityLabel={t('downloads.failureModal.reportLabel')}
              style={[styles.reportInput, { color: colors.text, minHeight: minTouch * 4 }]}
            />
          </ScrollView>
          <View style={{ gap: spacing.sm }}>
            <Button
              label={copied ? t('downloads.failureModal.copied') : t('downloads.failureModal.copy')}
              onPress={() => void handleCopy()}
              testID="downloadFailure.copy"
            />
            <Button
              label={t('downloads.failureModal.dismiss')}
              variant="secondary"
              onPress={dismiss}
              testID="downloadFailure.dismiss"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 2,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', lineHeight: 28 },
  reportScroll: { borderWidth: 1, borderRadius: 12, maxHeight: 280 },
  reportInput: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
});
