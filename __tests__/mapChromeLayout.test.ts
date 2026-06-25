import {
  computeActionColumnWidth,
  computeActionStackHeight,
  computeMapChromeLayout,
  MINIMAL_INSTRUMENT_STRIP_HEIGHT,
} from '../src/features/map/mapChromeLayout';

describe('computeMapChromeLayout', () => {
  const base = {
    chromeLeft: 16,
    chromeRight: 16,
    chromeTop: 48,
    chromeBottom: 16,
    minTouch: 48,
    spacingSm: 8,
    tabBarInsetBottom: 34,
  };

  it('reserves right column width when side actions are shown', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(layout.actionColumnWidth).toBeGreaterThan(0);
    expect(layout.actionColumnWidth).toBe(computeActionColumnWidth(base.minTouch, base.chromeRight, base.spacingSm));
  });

  it('does not reserve action column width in minimal layout', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'minimal',
      showSideActions: false,
    });
    expect(layout.actionColumnWidth).toBe(0);
  });

  it('aligns non-minimal actions and attribution on the same baseline', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(layout.actionsBottom).toBe(layout.attributionBottom);
  });

  it('lifts attribution above the minimal dock', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'minimal',
      showSideActions: false,
    });
    expect(layout.attributionBottom).toBeGreaterThan(layout.minimalStripBottom);
    expect(layout.attributionBottom).toBe(
      layout.minimalStripBottom + MINIMAL_INSTRUMENT_STRIP_HEIGHT + base.spacingSm,
    );
  });

  it('computes action stack height for compass placement', () => {
    const height = computeActionStackHeight(base.minTouch, base.spacingSm);
    expect(height).toBeGreaterThan(base.minTouch * 3);
  });

  it('places feedback above the tab bar', () => {
    const layout = computeMapChromeLayout({
      ...base,
      layoutPreset: 'map-forward',
      showSideActions: true,
    });
    expect(layout.feedbackAboveTabBar).toBe(base.tabBarInsetBottom + 56 + base.spacingSm);
  });
});
