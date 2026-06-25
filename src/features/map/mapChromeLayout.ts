import type { LayoutPreset } from '../../settings/defaults';

/** Vertical gap between stacked map chrome rows. */
export const MAP_CHROME_GAP = 8;

/** Horizontal padding inside action buttons (each side). */
export const MAP_ACTION_BTN_PADDING_H = 14;

/** Estimated tab bar content height excluding safe-area inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/** Three stacked action buttons (Tools, Anchor, MOB) + gaps. */
export const MAP_ACTION_STACK_COUNT = 3;

/** Height of the minimal layout bottom instrument dock (SOG/COG + actions). */
export const MINIMAL_INSTRUMENT_STRIP_HEIGHT = 92;

export type MapChromeLayout = {
  /** Left safe-area padding for overlays. */
  left: number;
  /** Right safe-area padding for overlays. */
  right: number;
  /** Top safe-area padding for overlays. */
  top: number;
  /** Bottom safe-area padding within the map viewport. */
  bottom: number;
  /** Reserve right edge so top chips never sit under the action column. */
  actionColumnWidth: number;
  /** Total height of the action button stack (for ornament placement). */
  actionStackHeight: number;
  /** Bottom inset for the action column. */
  actionsBottom: number;
  /** Bottom inset for MapLibre attribution. */
  attributionBottom: number;
  /** Bottom inset for minimal layout instrument strip. */
  minimalStripBottom: number;
  /** Bottom offset for toast/feedback above the tab bar (screen coords). */
  feedbackAboveTabBar: number;
};

type ComputeArgs = {
  chromeLeft: number;
  chromeRight: number;
  chromeTop: number;
  chromeBottom: number;
  minTouch: number;
  spacingSm: number;
  layoutPreset: LayoutPreset;
  tabBarInsetBottom: number;
  showSideActions: boolean;
};

/** Width of the right-side Tools / Anchor / MOB column including margin. */
export function computeActionColumnWidth(minTouch: number, chromeRight: number, spacingSm: number): number {
  const btnWidth = minTouch + MAP_ACTION_BTN_PADDING_H * 2;
  return btnWidth + chromeRight + spacingSm;
}

/** Total vertical space used by the stacked action buttons. */
export function computeActionStackHeight(minTouch: number, spacingSm: number): number {
  const btnHeight = minTouch + 20;
  return MAP_ACTION_STACK_COUNT * btnHeight + (MAP_ACTION_STACK_COUNT - 1) * spacingSm;
}

export function computeMapChromeLayout({
  chromeLeft,
  chromeRight,
  chromeTop,
  chromeBottom,
  minTouch,
  spacingSm,
  layoutPreset,
  tabBarInsetBottom,
  showSideActions,
}: ComputeArgs): MapChromeLayout {
  const baseBottom = chromeBottom + spacingSm;
  const actionColumnWidth = showSideActions ? computeActionColumnWidth(minTouch, chromeRight, spacingSm) : 0;
  const actionStackHeight = showSideActions ? computeActionStackHeight(minTouch, spacingSm) : 0;

  const minimalDockHeight = MINIMAL_INSTRUMENT_STRIP_HEIGHT;
  const attributionBottom =
    layoutPreset === 'minimal' ? baseBottom + minimalDockHeight + spacingSm : baseBottom;

  return {
    left: chromeLeft,
    right: chromeRight,
    top: chromeTop,
    bottom: baseBottom,
    actionColumnWidth,
    actionStackHeight,
    actionsBottom: baseBottom,
    attributionBottom,
    minimalStripBottom: baseBottom,
    feedbackAboveTabBar: tabBarInsetBottom + TAB_BAR_CONTENT_HEIGHT + spacingSm,
  };
}
