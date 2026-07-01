import type { LayoutPreset } from '../../settings/defaults';

import {
  CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX,
  mapBottomPanelReserve,
  PASSAGE_PLANNING_PANEL_CONTENT_MAX,
} from './mapChromeLayout';

/** @deprecated Use mapBottomPanelReserve(PASSAGE_PLANNING_PANEL_CONTENT_MAX). */
export const PASSAGE_PLANNING_PANEL_RESERVE = mapBottomPanelReserve(PASSAGE_PLANNING_PANEL_CONTENT_MAX);

/** @deprecated Use mapBottomPanelReserve(CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX). */
export const CUSTOM_DOWNLOAD_PANEL_RESERVE = mapBottomPanelReserve(CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX);

export type MapSurfaceMode = {
  showBottomDock: boolean;
  showSafetyBar: boolean;
  /** Preset driving dock height + ornament lift (minimal when chart overlay on instruments-only). */
  dockLayoutPreset: LayoutPreset;
  expandedInstrumentDock: boolean;
  /** Extra lift above tab bar when only the safety bar is shown. */
  safetyBarReserved: boolean;
  /** Combined bottom reserve for ornament / attribution lift. */
  bottomChromeReserve: number;
};

export function computeMapSurfaceMode(params: {
  layoutPreset: LayoutPreset;
  showChartInInstrumentsOnly: boolean;
  customSelecting: boolean;
  passageMapPlanning: boolean;
  mobTarget: boolean;
  screenLocked: boolean;
  passageFollowing: boolean;
}): MapSurfaceMode {
  const isInstrumentsOnly = params.layoutPreset === 'instruments-only';
  const chartOverlay = isInstrumentsOnly && params.showChartInInstrumentsOnly;

  const showBottomDock =
    !params.screenLocked &&
    !params.mobTarget &&
    !params.customSelecting &&
    !params.passageMapPlanning &&
    (params.layoutPreset === 'minimal' ||
      params.layoutPreset === 'map-forward' ||
      chartOverlay);

  const showSafetyBar =
    !params.screenLocked && !params.mobTarget && (params.customSelecting || params.passageMapPlanning);

  let dockLayoutPreset: LayoutPreset;
  if (chartOverlay) {
    dockLayoutPreset = 'minimal';
  } else if (showBottomDock) {
    dockLayoutPreset = isInstrumentsOnly ? 'minimal' : params.layoutPreset;
  } else if (!showSafetyBar) {
    dockLayoutPreset = 'instruments-only';
  } else {
    dockLayoutPreset = 'instruments-only';
  }

  const expandedInstrumentDock = showBottomDock && !params.mobTarget && params.passageFollowing;

  let bottomChromeReserve = 0;
  if (showBottomDock) {
    bottomChromeReserve = 0;
  } else if (params.passageMapPlanning) {
    bottomChromeReserve = mapBottomPanelReserve(PASSAGE_PLANNING_PANEL_CONTENT_MAX);
  } else if (params.customSelecting) {
    bottomChromeReserve = mapBottomPanelReserve(CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX);
  }

  return {
    showBottomDock,
    showSafetyBar,
    dockLayoutPreset,
    expandedInstrumentDock,
    safetyBarReserved: showSafetyBar && !showBottomDock,
    bottomChromeReserve,
  };
}
