import {
  MAP_SPLIT_MIN_WINDOW_HEIGHT,
  MAP_SPLIT_PANEL_MAX_WIDTH,
  MAP_SPLIT_PANEL_MIN_WIDTH,
  resolveInstrumentPanelOnLeft,
  resolveMapSplitPanelWidth,
  shouldSplitMapLayout,
  shouldUseMasterDetail,
} from '../src/lib/responsive/splitLayout';

describe('splitLayout', () => {
  it('splits map on tablet landscape only (expanded width + tall enough)', () => {
    expect(shouldSplitMapLayout('expanded', true, 'map-forward', 800)).toBe(true);
    expect(shouldSplitMapLayout('expanded', true, 'minimal', 800)).toBe(true);
    expect(shouldSplitMapLayout('expanded', true, 'map-forward', 412)).toBe(false);
    expect(shouldSplitMapLayout('medium', true, 'map-forward', 800)).toBe(false);
    expect(shouldSplitMapLayout('medium', false, 'map-forward', 1280)).toBe(false);
    expect(shouldSplitMapLayout('compact', true, 'map-forward', 800)).toBe(false);
    expect(shouldSplitMapLayout('expanded', false, 'map-forward', 1280)).toBe(false);
    expect(shouldSplitMapLayout('expanded', true, 'instruments-only', 800)).toBe(false);
  });

  it('uses master–detail on medium and expanded', () => {
    expect(shouldUseMasterDetail('compact')).toBe(false);
    expect(shouldUseMasterDetail('medium')).toBe(true);
    expect(shouldUseMasterDetail('expanded')).toBe(true);
  });

  it('places instrument panel on starboard by default in landscape', () => {
    expect(resolveInstrumentPanelOnLeft('auto', true)).toBe(false);
    expect(resolveInstrumentPanelOnLeft('port', true)).toBe(true);
    expect(resolveInstrumentPanelOnLeft('starboard', true)).toBe(false);
    expect(resolveInstrumentPanelOnLeft('port', false)).toBe(false);
  });

  it('reserves most width for the map on tablet landscape', () => {
    const width = 1280;
    const panel = resolveMapSplitPanelWidth(width, 'map-forward');
    expect(panel).toBeGreaterThanOrEqual(MAP_SPLIT_PANEL_MIN_WIDTH);
    expect(panel).toBeLessThanOrEqual(MAP_SPLIT_PANEL_MAX_WIDTH);
    expect(width - panel).toBeGreaterThan(width * 0.68);
  });

  it('uses a narrower panel in minimal layout', () => {
    const width = 1280;
    expect(resolveMapSplitPanelWidth(width, 'minimal')).toBeLessThan(
      resolveMapSplitPanelWidth(width, 'map-forward'),
    );
  });

  it('requires minimum window height for split', () => {
    expect(MAP_SPLIT_MIN_WINDOW_HEIGHT).toBeGreaterThanOrEqual(600);
  });
});
