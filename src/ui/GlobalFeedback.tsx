import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useFeedbackStore, type FeedbackKind } from '../store/feedbackStore';
import { useTheme } from '../theme/ThemeContext';
import { FEEDBACK_SHEET_ID, useSheetHost, useSheetHostSnapshotPublic } from './sheetHost';

type BannerProps = {
  message: string;
  kind: FeedbackKind;
  onDismiss: () => void;
  topOffset: number;
  horizontalInset: number;
};

/**
 * Top snackbar — stays clear of map bottom chrome (tab bar, planning panel, instruments).
 * Errors use assertive live region; success/info are polite and auto-dismiss.
 */
function FeedbackBanner({ message, kind, onDismiss, topOffset, horizontalInset }: BannerProps) {
  const { colors, spacing, minTouch } = useTheme();

  const palette =
    kind === 'error'
      ? { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger }
      : kind === 'info'
        ? { bg: colors.surface, border: colors.border, text: colors.text }
        : { bg: colors.successBg, border: colors.success, text: colors.success };

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: topOffset, paddingHorizontal: horizontalInset }]}>
      <View
        testID="feedback.banner"
        style={[
          styles.wrap,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            shadowColor: colors.text,
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      >
        <Text style={[styles.text, { color: palette.text, flex: 1 }]} numberOfLines={4}>
          {message}
        </Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          hitSlop={8}
          style={[styles.dismissBtn, { minWidth: minTouch, minHeight: minTouch }]}
        >
          <Text style={[styles.dismissGlyph, { color: palette.text }]} accessibilityElementsHidden>
            ×
          </Text>
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
  const { register, unregister } = useSheetHost();
  const { sheetTop } = useSheetHostSnapshotPublic();

  const topOffset = insets.top + spacing.sm;
  const horizontalInset = Math.max(spacing.lg, insets.left, insets.right);

  const renderOverlay = useCallback(() => {
    if (!message || !kind) return null;
    return (
      <FeedbackBanner
        message={message}
        kind={kind}
        onDismiss={clear}
        topOffset={topOffset}
        horizontalInset={horizontalInset}
      />
    );
  }, [message, kind, clear, topOffset, horizontalInset]);

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
      topOffset={topOffset}
      horizontalInset={horizontalInset}
    />
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 100, elevation: 8, alignItems: 'center' },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  dismissBtn: { alignItems: 'center', justifyContent: 'center' },
  dismissGlyph: { fontSize: 26, fontWeight: '400', lineHeight: 28 },
});
