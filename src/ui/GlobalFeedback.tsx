import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MINIMAL_INSTRUMENT_STRIP_HEIGHT, TAB_BAR_CONTENT_HEIGHT } from '../features/map/mapChromeLayout';
import { useFormFactor } from '../hooks/useFormFactor';
import { useEffectiveLayoutPreset } from '../hooks/useEffectiveLayoutPreset';
import { t } from '../i18n';
import { useFeedbackStore, type FeedbackKind } from '../store/feedbackStore';
import { useTheme } from '../theme/ThemeContext';
import { FEEDBACK_SHEET_ID, useSheetHost, useSheetHostSnapshotPublic } from './sheetHost';

type BannerProps = {
  message: string;
  kind: FeedbackKind;
  onDismiss: () => void;
  bottomOffset: number;
  horizontalInset: number;
};

function FeedbackBanner({ message, kind, onDismiss, bottomOffset, horizontalInset }: BannerProps) {
  const { colors, spacing, minTouch } = useTheme();

  const palette =
    kind === 'error'
      ? { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger }
      : kind === 'info'
        ? { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningText }
        : { bg: colors.successBg, border: colors.border, text: colors.success };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottomOffset, paddingBottom: spacing.xs }]}
    >
      <View
        testID="feedback.banner"
        style={[
          styles.wrap,
          { backgroundColor: palette.bg, borderColor: palette.border, marginHorizontal: horizontalInset },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      >
        <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          style={[styles.dismiss, { minHeight: minTouch }]}
        >
          <Text style={[styles.dismissText, { color: palette.text }]}>{t('common.dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function GlobalFeedback() {
  const message = useFeedbackStore((s) => s.message);
  const kind = useFeedbackStore((s) => s.kind);
  const clear = useFeedbackStore((s) => s.clear);
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { formFactor, isLandscape } = useFormFactor();
  const layoutPreset = useEffectiveLayoutPreset();
  const { register, unregister } = useSheetHost();
  const { sheetTop } = useSheetHostSnapshotPublic();

  const hasBottomTabBar = formFactor === 'compact' || !isLandscape;
  const minimalDockExtra = layoutPreset === 'minimal' ? MINIMAL_INSTRUMENT_STRIP_HEIGHT + spacing.sm : 0;
  const bottomOffset = insets.bottom + (hasBottomTabBar ? TAB_BAR_CONTENT_HEIGHT : 0) + spacing.sm + minimalDockExtra;
  const horizontalInset = spacing.lg;

  const renderOverlay = useCallback(() => {
    if (!message || !kind) return null;
    return (
      <FeedbackBanner
        message={message}
        kind={kind}
        onDismiss={clear}
        bottomOffset={bottomOffset}
        horizontalInset={horizontalInset}
      />
    );
  }, [message, kind, clear, bottomOffset, horizontalInset]);

  const elevateOverSheets = Boolean(message && kind && sheetTop);

  useEffect(() => {
    if (!elevateOverSheets) {
      unregister(FEEDBACK_SHEET_ID);
      return;
    }
    register(FEEDBACK_SHEET_ID, 0, renderOverlay, clear);
    return () => unregister(FEEDBACK_SHEET_ID);
  }, [elevateOverSheets, register, unregister, renderOverlay, clear]);

  if (!message || !kind || elevateOverSheets) return null;

  return (
    <FeedbackBanner
      message={message}
      kind={kind}
      onDismiss={clear}
      bottomOffset={bottomOffset}
      horizontalInset={horizontalInset}
    />
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 100, elevation: 8 },
  wrap: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  text: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center' },
  dismiss: { marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});
