import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computeMapChromeLayout } from '../features/map/mapChromeLayout';
import { mapChromeInsets } from '../features/map/mapChromeInsets';
import { useTheme } from '../theme/ThemeContext';
import { useEffectiveLayoutPreset } from './useEffectiveLayoutPreset';

type Options = {
  showSideActions?: boolean;
};

/** Bottom + side chrome insets for map overlays and MapLibre ornaments. */
export function useMapBottomLayout(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const { spacing, minTouch } = useTheme();
  const layoutPreset = useEffectiveLayoutPreset();
  const showSideActions = options.showSideActions ?? layoutPreset !== 'minimal';
  const chrome = mapChromeInsets(insets, spacing.lg);

  return useMemo(
    () =>
      computeMapChromeLayout({
        chromeLeft: chrome.left,
        chromeRight: chrome.right,
        chromeTop: chrome.top,
        chromeBottom: chrome.bottom,
        minTouch,
        spacingSm: spacing.sm,
        layoutPreset,
        tabBarInsetBottom: insets.bottom,
        showSideActions,
      }),
    [
      chrome.left,
      chrome.right,
      chrome.top,
      chrome.bottom,
      minTouch,
      spacing.sm,
      layoutPreset,
      insets.bottom,
      showSideActions,
    ],
  );
}
