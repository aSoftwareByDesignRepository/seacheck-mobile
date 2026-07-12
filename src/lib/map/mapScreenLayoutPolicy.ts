/**
 * Pure map-screen layout policy — testable, no React dependencies.
 * Drives split panes, safety chrome placement, and bottom docks.
 */

export function isInstrumentPanelAllowed(params: {
  customSelecting: boolean;
  passageMapPlanning: boolean;
  hasMobTarget: boolean;
}): boolean {
  return !params.customSelecting && !params.passageMapPlanning && !params.hasMobTarget;
}

/** Split is active only when the device supports it AND the side panel is shown. */
export function effectiveMapSplit(splitCapable: boolean, instrumentPanelAllowed: boolean): boolean {
  return splitCapable && instrumentPanelAllowed;
}

/** Safety column (lock / anchor / MOB) — map pane when split, screen root when stacked. */
export function resolveMapSafetyChromePlacement(params: {
  showSideActions: boolean;
  effectiveSplit: boolean;
}): 'mapPane' | 'root' | 'none' {
  if (!params.showSideActions) return 'none';
  return params.effectiveSplit ? 'mapPane' : 'root';
}
