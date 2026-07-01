import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  computeSafetyActionsMetrics,
  type SafetyActionsVariant,
} from '../features/map/mapSafetyActionsLayout';
import { mapChromeInsets } from '../features/map/mapChromeInsets';
import { useTheme } from '../theme/ThemeContext';
import { useFormFactor } from './useFormFactor';

/** Responsive lock / anchor / MOB button sizing for side column vs minimal inline stack. */
export function useSafetyActionsMetrics(variant: SafetyActionsVariant, showAnchor = true) {
  const { minTouch, spacing } = useTheme();
  const { formFactor } = useFormFactor();
  const insets = useSafeAreaInsets();
  const chrome = mapChromeInsets(insets, spacing.lg);

  return useMemo(
    () =>
      computeSafetyActionsMetrics({
        minTouch,
        spacingSm: spacing.sm,
        spacingMd: spacing.md,
        formFactor,
        variant,
        showAnchor,
        chromeRight: chrome.right,
      }),
    [minTouch, spacing.sm, spacing.md, formFactor, variant, showAnchor, chrome.right],
  );
}
