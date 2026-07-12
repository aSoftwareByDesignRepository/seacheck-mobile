import {
  MAP_SPLIT_MIN_WINDOW_HEIGHT,
  resolveMapSplitPanelWidth,
  shouldSplitMapLayout,
} from '../src/lib/responsive/splitLayout';
import type { LayoutPreset } from '../src/settings/defaults';

const TABLET_LANDSCAPE = { formFactor: 'expanded' as const, width: 1280, height: 800, isLandscape: true };
const PHONE_LANDSCAPE = { formFactor: 'medium' as const, width: 892, height: 412, isLandscape: true };

/** Every layout preset × device class the map screen must handle in landscape. */
describe('landscape layout presets', () => {
  const presets: LayoutPreset[] = ['map-forward', 'minimal', 'instruments-only'];

  it.each(presets)('%s — tablet landscape splits except instruments-only', (preset) => {
    const split = shouldSplitMapLayout(
      TABLET_LANDSCAPE.formFactor,
      TABLET_LANDSCAPE.isLandscape,
      preset,
      TABLET_LANDSCAPE.height,
    );
    if (preset === 'instruments-only') {
      expect(split).toBe(false);
    } else {
      expect(split).toBe(true);
    }
  });

  it.each(presets)('%s — phone landscape never splits (stacked + bottom dock)', (preset) => {
    expect(
      shouldSplitMapLayout(
        PHONE_LANDSCAPE.formFactor,
        PHONE_LANDSCAPE.isLandscape,
        preset,
        PHONE_LANDSCAPE.height,
      ),
    ).toBe(false);
  });

  it('map-forward panel is wider than minimal on tablet', () => {
    expect(resolveMapSplitPanelWidth(TABLET_LANDSCAPE.width, 'map-forward')).toBeGreaterThan(
      resolveMapSplitPanelWidth(TABLET_LANDSCAPE.width, 'minimal'),
    );
  });

  it('panel width leaves map with at least 68% on tablet landscape', () => {
    for (const preset of ['map-forward', 'minimal'] as LayoutPreset[]) {
      const panel = resolveMapSplitPanelWidth(TABLET_LANDSCAPE.width, preset);
      expect(TABLET_LANDSCAPE.width - panel).toBeGreaterThanOrEqual(Math.floor(TABLET_LANDSCAPE.width * 0.68));
    }
  });

  it('requires tablet-height landscape for split (excludes rotated phones)', () => {
    expect(
      shouldSplitMapLayout('expanded', true, 'map-forward', PHONE_LANDSCAPE.height),
    ).toBe(false);
    expect(
      shouldSplitMapLayout('expanded', true, 'map-forward', MAP_SPLIT_MIN_WINDOW_HEIGHT),
    ).toBe(true);
  });
});
