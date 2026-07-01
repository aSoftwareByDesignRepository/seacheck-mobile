import {
  computeMapSurfaceMode,
  CUSTOM_DOWNLOAD_PANEL_RESERVE,
  PASSAGE_PLANNING_PANEL_RESERVE,
} from '../src/features/map/mapSurfaceMode';

describe('computeMapSurfaceMode', () => {
  const base = {
    layoutPreset: 'map-forward' as const,
    showChartInInstrumentsOnly: false,
    customSelecting: false,
    passageMapPlanning: false,
    mobTarget: false,
    screenLocked: false,
    passageFollowing: false,
  };

  it('shows bottom dock on minimal and map-forward layouts', () => {
    expect(computeMapSurfaceMode({ ...base, layoutPreset: 'minimal' }).showBottomDock).toBe(true);
    expect(computeMapSurfaceMode({ ...base, layoutPreset: 'map-forward' }).showBottomDock).toBe(true);
  });

  it('hides bottom dock during passage planning and shows safety bar', () => {
    const mode = computeMapSurfaceMode({ ...base, passageMapPlanning: true });
    expect(mode.showBottomDock).toBe(false);
    expect(mode.showSafetyBar).toBe(true);
    expect(mode.bottomChromeReserve).toBe(PASSAGE_PLANNING_PANEL_RESERVE);
  });

  it('hides bottom dock during custom download and lifts ornaments', () => {
    const mode = computeMapSurfaceMode({ ...base, customSelecting: true });
    expect(mode.showBottomDock).toBe(false);
    expect(mode.showSafetyBar).toBe(true);
    expect(mode.bottomChromeReserve).toBe(CUSTOM_DOWNLOAD_PANEL_RESERVE);
  });

  it('uses minimal dock preset when instruments-only shows chart overlay', () => {
    const mode = computeMapSurfaceMode({
      ...base,
      layoutPreset: 'instruments-only',
      showChartInInstrumentsOnly: true,
    });
    expect(mode.showBottomDock).toBe(true);
    expect(mode.dockLayoutPreset).toBe('minimal');
  });

  it('hides dock and safety bar when screen is locked or MOB is active', () => {
    expect(computeMapSurfaceMode({ ...base, screenLocked: true }).showBottomDock).toBe(false);
    expect(computeMapSurfaceMode({ ...base, screenLocked: true }).showSafetyBar).toBe(false);
    expect(computeMapSurfaceMode({ ...base, mobTarget: true }).showBottomDock).toBe(false);
    expect(computeMapSurfaceMode({ ...base, mobTarget: true }).showSafetyBar).toBe(false);
  });

  it('expands instrument dock while following a passage', () => {
    const mode = computeMapSurfaceMode({ ...base, passageFollowing: true });
    expect(mode.expandedInstrumentDock).toBe(true);
  });
});
