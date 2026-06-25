import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { radius } from '../theme/tokens';

/** Shared pill chip layout — avoids minHeight + paddingVertical clipping on Android. */
export function touchChipStyle(minTouch: number, extra: ViewStyle = {}): ViewStyle {
  return {
    minHeight: minTouch,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...extra,
  };
}

export const touchChipText: TextStyle = {
  fontSize: 13,
  fontWeight: '700',
  lineHeight: 18,
  textAlign: 'center',
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};

/** Informational status badge — not a primary touch target. */
export function statusBadgeStyle(extra: ViewStyle = {}): ViewStyle {
  return {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    ...extra,
  };
}

export const statusBadgeText: TextStyle = {
  fontSize: 12,
  fontWeight: '700',
  lineHeight: 16,
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};

/** Filter / settings chip — selectable pill button. */
export function filterChipStyle(minTouch: number, extra: ViewStyle = {}): ViewStyle {
  return touchChipStyle(minTouch, { paddingHorizontal: 14, ...extra });
}

export const filterChipText: TextStyle = {
  fontSize: 14,
  fontWeight: '700',
  lineHeight: 20,
  textAlign: 'center',
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
};

export const chipRow = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowScroll: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
});
