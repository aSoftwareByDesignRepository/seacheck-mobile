import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computeMapChromeLayout } from '../features/map/mapChromeLayout';
import { mapChromeInsets } from '../features/map/mapChromeInsets';
import { tabBarOccupiedHeight, usesBottomTabBar } from '../lib/navigation/tabBarGeometry';
import { useTheme } from '../theme/ThemeContext';
import { useEffectiveMapSplit } from './useEffectiveMapSplit';
import { useFormFactor } from './useFormFactor';
import { useMapSurfaceMode } from './useMapSurfaceMode';

type Options = {
  showSideActions?: boolean;
  /** Rendered safety buttons (2 when the anchor action is hidden). Default 3. */
  safetyButtonCount?: number;
};

/** Bottom + side chrome insets for map overlays and MapLibre ornaments. */
export function useMapBottomLayout(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const { spacing, minTouch } = useTheme();
  const surface = useMapSurfaceMode();
  const showSideActions = options.showSideActions ?? true;
  const { formFactor, isLandscape, height } = useFormFactor();
  const effectiveSplit = useEffectiveMapSplit();
  const tabBarAtBottom = usesBottomTabBar(formFactor, isLandscape);
  const chrome = mapChromeInsets(insets, spacing.lg);
  const paneHeight = tabBarAtBottom
    ? height - tabBarOccupiedHeight(insets.bottom, minTouch)
    : height;

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
        safetyButtonCount: options.safetyButtonCount,
        paneHeight,
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
      paneHeight,
      surface.dockLayoutPreset,
      surface.expandedInstrumentDock,
      surface.bottomChromeReserve,
      insets.bottom,
      showSideActions,
      tabBarAtBottom,
      effectiveSplit,
      options.safetyButtonCount,
    ],
  );
}
