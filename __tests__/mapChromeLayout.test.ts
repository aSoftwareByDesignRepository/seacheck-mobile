import {
  computeMaxSafetyStackHeight,
  computeSafetyActionsMetrics,
  MAP_SAFETY_COLUMN_EXPANDED_LIFT,
  MAP_SAFETY_COLUMN_GAP,
} from '../src/features/map/mapSafetyActionsLayout';
import {
  computeActionColumnWidth,
  computeActionStackHeight,
  computeMapChromeLayout,
  MAP_COMPASS_ORNAMENT_HEIGHT,
  MAP_COMPASS_ABOVE_STACK_GAP,
  MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT,
  MAP_FORWARD_PASSAGE_INSTRUMENT_DOCK_HEIGHT,
  MINIMAL_INSTRUMENT_DOCK_HEIGHT,
  MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT,
} from '../src/features/map/mapChromeLayout';

const base = {
  chromeLeft: 16,
  chromeRight: 16,
  chromeTop: 48,
  chromeBottom: 16,
  minTouch: 48,
  spacingSm: 8,
  spacingMd: 12,
  formFactor: 'compact' as const,
  tabBarInsetBottom: 34,
};

describe('computeMapChromeLayout', () => {
  it('does not reserve action column width when side actions are hidden', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: false,
    });
    expect(layout.actionColumnWidth).toBe(0);
  });

  it('reserves action column width when side actions are shown', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'instruments-only',
      showSideActions: true,
    });
    expect(layout.actionColumnWidth).toBe(computeActionColumnWidth(base.minTouch, base.chromeRight, base.spacingSm));
  });

  it('uses wider side column on expanded tablets', () => {
    const compact = computeMapChromeLayout({ ...base, layoutPreset: 'map-forward', showSideActions: true });
    const expanded = computeMapChromeLayout({
      ...base,
      formFactor: 'expanded',
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(expanded.actionColumnWidth).toBeGreaterThan(compact.actionColumnWidth);
    expect(expanded.actionStackHeight).toBeGreaterThan(compact.actionStackHeight);
  });

  it('lifts attribution above the minimal dock', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'minimal',
      showSideActions: false,
    });
    expect(layout.attributionBottom).toBeGreaterThan(layout.instrumentDockBottom);
    expect(layout.attributionBottom).toBe(
      layout.instrumentDockBottom + MINIMAL_INSTRUMENT_DOCK_HEIGHT + base.spacingSm,
    );
  });

  it('lifts attribution above the map-forward dock', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: false,
    });
    expect(layout.attributionBottom).toBe(
      layout.instrumentDockBottom + MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT + base.spacingSm,
    );
    expect(layout.ornamentBottom).toBe(layout.attributionBottom);
  });

  it('expands minimal dock height while following a passage', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'minimal',
      showSideActions: false,
      expandedInstrumentDock: true,
    });
    expect(layout.instrumentDockHeight).toBe(MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT);
    expect(layout.attributionBottom).toBe(
      layout.instrumentDockBottom + MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT + base.spacingSm,
    );
  });

  it('expands map-forward dock height while following a passage', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: false,
      expandedInstrumentDock: true,
    });
    expect(layout.instrumentDockHeight).toBe(MAP_FORWARD_PASSAGE_INSTRUMENT_DOCK_HEIGHT);
  });

  it('lifts side safety column above bottom instrument dock', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(layout.actionsColumnBottom).toBe(
      layout.instrumentDockBottom + MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT + MAP_SAFETY_COLUMN_GAP,
    );
  });

  it('adds extra lift above expanded instrument dock', () => {
    const normal = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
      expandedInstrumentDock: false,
    });
    const expanded = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
      expandedInstrumentDock: true,
    });
    expect(expanded.actionsColumnBottom - normal.actionsColumnBottom).toBe(
      MAP_FORWARD_PASSAGE_INSTRUMENT_DOCK_HEIGHT -
        MAP_FORWARD_INSTRUMENT_DOCK_HEIGHT +
        MAP_SAFETY_COLUMN_EXPANDED_LIFT,
    );
  });

  it('places compass above side safety stack and bottom dock', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(layout.compassBottom).toBeGreaterThanOrEqual(
      layout.actionsColumnBottom + layout.actionStackHeight + MAP_COMPASS_ORNAMENT_HEIGHT + MAP_COMPASS_ABOVE_STACK_GAP + base.spacingSm,
    );
    expect(layout.compassBottom).toBeGreaterThanOrEqual(layout.ornamentBottom + base.spacingSm);
  });

  it('computes action stack height for side safety column', () => {
    const height = computeActionStackHeight(base.minTouch, base.spacingSm);
    expect(height).toBe(computeMaxSafetyStackHeight(base.minTouch, base.spacingSm, base.spacingMd, 'compact'));
    expect(height).toBeGreaterThan(base.minTouch * 3);
  });

  it('places feedback above the tab bar', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: false,
    });
    expect(layout.feedbackAboveTabBar).toBe(base.tabBarInsetBottom + 56 + base.spacingSm);
  });

  it('lifts ornaments when extra bottom reserve is set (download panels)', () => {
    const reserve = 240;
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'instruments-only',
      showSideActions: false,
      extraBottomReserved: reserve,
    });
    expect(layout.instrumentDockHeight).toBe(0);
    expect(layout.ornamentBottom).toBe(layout.instrumentDockBottom + reserve + base.spacingSm);
  });

  it('lifts side column above download panel with extra gap', () => {
    const reserve = 192;
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'instruments-only',
      showSideActions: true,
      extraBottomReserved: reserve,
    });
    expect(layout.actionsColumnBottom).toBe(
      layout.instrumentDockBottom + reserve + MAP_SAFETY_COLUMN_GAP + MAP_SAFETY_COLUMN_GAP,
    );
  });
});

describe('computeSafetyActionsMetrics', () => {
  it('inline variant is more compact than side column', () => {
    const side = computeSafetyActionsMetrics({
      minTouch: 48,
      spacingSm: 8,
      spacingMd: 12,
      formFactor: 'compact',
      variant: 'side',
      showAnchor: true,
      chromeRight: 16,
    });
    const inline = computeSafetyActionsMetrics({
      minTouch: 48,
      spacingSm: 8,
      spacingMd: 12,
      formFactor: 'compact',
      variant: 'inline',
      showAnchor: true,
      chromeRight: 16,
    });
    expect(inline.stackHeight).toBeLessThan(side.stackHeight);
    expect(inline.gap).toBeLessThanOrEqual(side.gap);
  });
});
