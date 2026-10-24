import type { FormFactor } from '../../hooks/useFormFactor';
import {
  computeMinimalInstrumentDockHeight,
  computeMinimalPassageInstrumentDockHeight,
  instrumentHeroSizeForFormFactor,
} from '../../ui/instrumentLayout';

import {
  computeMaxSafetyColumnWidth,
  computeMaxSafetyStackHeight,
  computeSafetyActionsMetrics,
  MAP_SAFETY_COLUMN_EXPANDED_LIFT,
  MAP_SAFETY_COLUMN_GAP,
} from './mapSafetyActionsLayout';

/** Vertical gap between stacked map chrome rows. */
export const MAP_CHROME_GAP = 8;

/** MapLibre compass ornament height — bottom inset is the ornament's lower edge. */
export const MAP_COMPASS_ORNAMENT_HEIGHT = 68;

/** Extra gap between compass ornament and side safety stack. */
export const MAP_COMPASS_ABOVE_STACK_GAP = 12;

/** @deprecated Use computeMaxSafetyColumnWidth — kept for tests referencing legacy padding. */
export const MAP_ACTION_BTN_PADDING_H = 14;

/** Estimated tab bar content height excluding safe-area inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/** Minimal layout bottom dock — SOG/COG row (safety actions on map edge). */
export const MINIMAL_INSTRUMENT_DOCK_HEIGHT = computeMinimalInstrumentDockHeight(8, instrumentHeroSizeForFormFactor('compact'));

/** Minimal dock with passage follow — meta + brg/dist + SOG/COG, no scroll. */
export const MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT = computeMinimalPassageInstrumentDockHeight(
  8,
  instrumentHeroSizeForFormFactor('compact'),
);

/** Map-forward dock — hero row, coords, metrics (safety actions on map edge). */
export const MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT = 220;

/** Map-forward dock while following a passage or MOB — room for Open/Deactivate CTA above tab bar. */
export const MAP_FORWARD_PASSAGE_INSTRUMENT_DOCK_HEIGHT = 348;

/** Max scrollable content height for passage planning panel — fits title, hint, and actions without scroll. */
export const PASSAGE_PLANNING_PANEL_CONTENT_MAX = 300;

/** Max scrollable content height for custom download panel. */
export const CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX = 360;

/** Total bottom reserve for map ornaments — panel content only (safety actions sit on the side). */
export function mapBottomPanelReserve(contentMaxHeight: number): number {
  return contentMaxHeight;
}

export type MapChromeLayout = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  actionColumnWidth: number;
  actionStackHeight: number;
  /** Bottom inset for side safety column when no bottom chrome is present. */
  actionsBottom: number;
  /** Bottom inset for side safety column — lifted above bottom docks / panels. */
  actionsColumnBottom: number;
  /** Side stack, or bottom-right row when the pane cannot fit the stack height. */
  safetyArrangement: 'column' | 'row';
  /** Vertical footprint of the current safety arrangement (stack or single row). */
  safetyChromeHeight: number;
  /** Recommended compass bottom inset — clears side stack and bottom chrome. */
  compassBottom: number;
  attributionBottom: number;
  instrumentDockBottom: number;
  instrumentDockHeight: number;
  ornamentBottom: number;
  feedbackAboveTabBar: number;
};

type ComputeArgs = {
  chromeLeft: number;
  chromeRight: number;
  chromeTop: number;
  chromeBottom: number;
  minTouch: number;
  spacingSm: number;
  spacingMd: number;
  formFactor: FormFactor;
  layoutPreset: import('../../settings/defaults').LayoutPreset;
  tabBarInsetBottom: number;
  showSideActions: boolean;
  expandedInstrumentDock?: boolean;
  tabBarAtBottom?: boolean;
  extraBottomReserved?: number;
  /** Side panel carries instruments — no bottom dock reserve on the map pane. */
  suppressBottomDock?: boolean;
  /** Rendered safety buttons (2 when the anchor action is hidden). Default 3. */
  safetyButtonCount?: number;
  /**
   * Map-pane host height (window minus bottom tab bar). Without it the column
   * arrangement is assumed — pass the real height so short panes (landscape
   * compact) fall back to the row arrangement instead of clipping off-screen.
   */
  paneHeight?: number;
};

/** @deprecated Use computeMaxSafetyColumnWidth. */
export function computeActionColumnWidth(minTouch: number, chromeRight: number, spacingSm: number): number {
  return computeMaxSafetyColumnWidth(minTouch, spacingSm, spacingSm, 'compact', chromeRight);
}

/** @deprecated Use computeMaxSafetyStackHeight. */
export function computeActionStackHeight(minTouch: number, spacingSm: number): number {
  return computeMaxSafetyStackHeight(minTouch, spacingSm, spacingSm, 'compact');
}

function instrumentDockHeightForPreset(
  layoutPreset: import('../../settings/defaults').LayoutPreset,
  expandedInstrumentDock: boolean,
  spacingSm: number,
  formFactor: FormFactor,
): number {
  const heroSize = instrumentHeroSizeForFormFactor(formFactor);
  if (layoutPreset === 'minimal') {
    return expandedInstrumentDock
      ? computeMinimalPassageInstrumentDockHeight(spacingSm, heroSize)
      : computeMinimalInstrumentDockHeight(spacingSm, heroSize);
  }
  if (layoutPreset === 'map-forward') {
    return expandedInstrumentDock ? MAP_FORWARD_PASSAGE_INSTRUMENT_DOCK_HEIGHT : MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT;
  }
  return 0;
}

function safetyColumnLift(expandedInstrumentDock: boolean, extraBottomReserved: number): number {
  let lift = MAP_SAFETY_COLUMN_GAP;
  if (expandedInstrumentDock) lift += MAP_SAFETY_COLUMN_EXPANDED_LIFT;
  if (extraBottomReserved > 0) lift += MAP_SAFETY_COLUMN_GAP;
  return lift;
}

export function computeMapChromeLayout({
  chromeLeft,
  chromeRight,
  chromeTop,
  chromeBottom,
  minTouch,
  spacingSm,
  spacingMd,
  formFactor,
  layoutPreset,
  tabBarInsetBottom,
  showSideActions,
  expandedInstrumentDock = false,
  tabBarAtBottom = true,
  extraBottomReserved = 0,
  suppressBottomDock = false,
  safetyButtonCount = 3,
  paneHeight,
}: ComputeArgs): MapChromeLayout {
  const baseBottom = chromeBottom + spacingSm;
  const actionStackHeight = showSideActions
    ? computeMaxSafetyStackHeight(minTouch, spacingSm, spacingMd, formFactor)
    : 0;
  const instrumentDockHeight = suppressBottomDock
    ? 0
    : instrumentDockHeightForPreset(
        layoutPreset,
        expandedInstrumentDock,
        spacingSm,
        formFactor,
      );
  const instrumentDockBottom = tabBarAtBottom ? 0 : baseBottom;
  const bottomReserved = instrumentDockHeight + extraBottomReserved;
  const hasBottomChrome = bottomReserved > 0;
  const columnLift = safetyColumnLift(expandedInstrumentDock, extraBottomReserved);

  const attributionBottom = hasBottomChrome
    ? instrumentDockBottom + bottomReserved + spacingSm
    : baseBottom;

  const actionsColumnBottom = hasBottomChrome
    ? instrumentDockBottom + bottomReserved + columnLift
    : baseBottom;

  // Compact-landscape fallback: when the pane cannot fit the real stack between
  // the top inset and the bottom-chrome anchor, render the safety actions as a
  // single bottom-right row — a column that tall would clip off the top edge.
  const actualStackHeight = showSideActions
    ? computeSafetyActionsMetrics({
        minTouch,
        spacingSm,
        spacingMd,
        formFactor,
        variant: 'side',
        showAnchor: safetyButtonCount > 2,
        chromeRight,
      }).stackHeight
    : 0;
  const safetyArrangement: 'column' | 'row' =
    showSideActions &&
    paneHeight != null &&
    paneHeight > 0 &&
    actualStackHeight > paneHeight - actionsColumnBottom - chromeTop - MAP_CHROME_GAP
      ? 'row'
      : 'column';
  const safetyChromeHeight = !showSideActions
    ? 0
    : safetyArrangement === 'row'
      ? computeSafetyActionsMetrics({
          minTouch,
          spacingSm,
          spacingMd,
          formFactor,
          variant: 'row',
          showAnchor: safetyButtonCount > 2,
          chromeRight,
        }).stackHeight
      : actualStackHeight;
  const actionColumnWidth = showSideActions && safetyArrangement === 'column'
    ? computeMaxSafetyColumnWidth(minTouch, spacingSm, spacingMd, formFactor, chromeRight)
    : 0;

  const ornamentBottom = hasBottomChrome
    ? instrumentDockBottom + bottomReserved + spacingSm
    : baseBottom + safetyChromeHeight + spacingSm;

  const compassBottom = showSideActions
    ? Math.max(
        ornamentBottom,
        actionsColumnBottom + safetyChromeHeight + MAP_COMPASS_ORNAMENT_HEIGHT + MAP_COMPASS_ABOVE_STACK_GAP,
      ) + spacingSm
    : ornamentBottom + spacingSm;

  return {
    left: chromeLeft,
    right: chromeRight,
    top: chromeTop,
    bottom: baseBottom,
    actionColumnWidth,
    actionStackHeight,
    actionsBottom: baseBottom,
    actionsColumnBottom,
    safetyArrangement,
    safetyChromeHeight,
    compassBottom,
    attributionBottom,
    instrumentDockBottom,
    instrumentDockHeight,
    ornamentBottom,
    feedbackAboveTabBar: tabBarInsetBottom + TAB_BAR_CONTENT_HEIGHT + spacingSm,
  };
}
