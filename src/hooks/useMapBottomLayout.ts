import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computeMapChromeLayout } from '../features/map/mapChromeLayout';
import { mapChromeInsets } from '../features/map/mapChromeInsets';
import { usesBottomTabBar } from '../lib/navigation/tabBarGeometry';
import { useTheme } from '../theme/ThemeContext';
import { useEffectiveMapSplit } from './useEffectiveMapSplit';
import { useFormFactor } from './useFormFactor';
import { useMapSurfaceMode } from './useMapSurfaceMode';

type Options = {
  showSideActions?: boolean;
};

/** Bottom + side chrome insets for map overlays and MapLibre ornaments. */
export function useMapBottomLayout(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const { spacing, minTouch } = useTheme();
  const surface = useMapSurfaceMode();
  const showSideActions = options.showSideActions ?? true;
  const { formFactor, isLandscape } = useFormFactor();
  const effectiveSplit = useEffectiveMapSplit();
  const tabBarAtBottom = usesBottomTabBar(formFactor, isLandscape);
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
        spacingMd: spacing.md,
        formFactor,
        layoutPreset: surface.dockLayoutPreset,
        tabBarInsetBottom: insets.bottom,
        showSideActions,
        expandedInstrumentDock: effectiveSplit ? false : surface.expandedInstrumentDock,
        tabBarAtBottom,
        extraBottomReserved: surface.bottomChromeReserve,
        suppressBottomDock: effectiveSplit,
      }),
    [
      chrome.left,
      chrome.right,
      chrome.top,
      chrome.bottom,
      minTouch,
      spacing.sm,
      spacing.md,
      formFactor,
      surface.dockLayoutPreset,
      surface.expandedInstrumentDock,
      surface.bottomChromeReserve,
      insets.bottom,
      showSideActions,
      tabBarAtBottom,
      effectiveSplit,
    ],
  );
}
