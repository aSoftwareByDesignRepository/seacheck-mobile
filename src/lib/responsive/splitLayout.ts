import type { FormFactor } from '../../hooks/useFormFactor';
import type { LayoutPreset, PanelSide } from '../../settings/defaults';

/**
 * Side-by-side map + instruments on tablet landscape only.
 * Requires expanded width (≥840 dp) AND enough vertical space (≥600 dp) so phones
 * rotated to landscape keep the stacked full-width map layout.
 */
export const MAP_SPLIT_MIN_WINDOW_HEIGHT = 600;

export function shouldSplitMapLayout(
  formFactor: FormFactor,
  isLandscape: boolean,
  layoutPreset: LayoutPreset,
  windowHeight: number,
): boolean {
  return (
    formFactor === 'expanded' &&
    isLandscape &&
    windowHeight >= MAP_SPLIT_MIN_WINDOW_HEIGHT &&
    layoutPreset !== 'instruments-only'
  );
}

/** Master–detail split for list screens on medium+ width. */
export function shouldUseMasterDetail(formFactor: FormFactor): boolean {
  return formFactor !== 'compact';
}

/** Instrument panel on the left (port) vs right (starboard). */
export function resolveInstrumentPanelOnLeft(panelSide: PanelSide, isLandscape: boolean): boolean {
  if (!isLandscape) return false;
  if (panelSide === 'port') return true;
  if (panelSide === 'starboard') return false;
  return false;
}

/** Side panel width bounds — map pane uses flex:1 for all remaining width. */
export const MAP_SPLIT_PANEL_MIN_WIDTH = 260;
export const MAP_SPLIT_PANEL_MAX_WIDTH = 380;

/** Fixed instrument panel width; map fills the rest (no flex-ratio dead space). */
export function resolveMapSplitPanelWidth(windowWidth: number, layoutPreset: LayoutPreset): number {
  const ratio = layoutPreset === 'minimal' ? 0.26 : 0.28;
  const max = layoutPreset === 'minimal' ? 320 : MAP_SPLIT_PANEL_MAX_WIDTH;
  return Math.round(Math.min(max, Math.max(MAP_SPLIT_PANEL_MIN_WIDTH, windowWidth * ratio)));
}
