/**
 * Layout regression matrix — every device class × orientation the shell must handle.
 * Catches rail/split/tab-bar regressions before they reach a device.
 */
import { resolveShellTabBarLayout } from '../src/lib/navigation/shellLayoutPolicy';
import { usesBottomTabBar, tabBarOccupiedHeight } from '../src/lib/navigation/tabBarGeometry';
import { resolveMapSplitPanelWidth, shouldSplitMapLayout } from '../src/lib/responsive/splitLayout';

type Row = {
  label: string;
  width: number;
  height: number;
  formFactor: 'compact' | 'medium' | 'expanded';
  bottomTabs: boolean;
  splitMap: boolean;
};

function bucket(width: number): Row['formFactor'] {
  if (width >= 840) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

function row(label: string, width: number, height: number, splitMap: boolean): Row {
  const formFactor = bucket(width);
  return {
    label,
    width,
    height,
    formFactor,
    bottomTabs: true,
    splitMap,
  };
}

/** Representative logical sizes (dp) — not exhaustive, but covers plan §6.7 UAT targets. */
const DEVICES: Row[] = [
  row('small phone portrait (320)', 320, 640, false),
  row('small phone landscape (568)', 568, 320, false),
  row('large phone portrait (412)', 412, 892, false),
  row('large phone landscape (892)', 892, 412, false),
  row('phablet portrait (600)', 600, 960, false),
  row('phablet landscape (960)', 960, 600, true),
  row('8″ tablet portrait (800)', 800, 1280, false),
  row('8″ tablet landscape (1280)', 1280, 800, true),
  row('10″ tablet portrait (840)', 840, 1280, false),
  row('10″ tablet landscape (1280)', 1280, 840, true),
];

describe('layout regression matrix', () => {
  it.each(DEVICES)('$label — bottom tabs, no rail, split=$splitMap', ({
    width,
    height,
    formFactor,
    bottomTabs,
    splitMap,
  }) => {
    const isLandscape = width > height;
    expect(bucket(width)).toBe(formFactor);

    const shell = resolveShellTabBarLayout(formFactor, isLandscape);
    expect(shell.useRail).toBe(false);
    expect(shell.tabBarPosition).toBe('bottom');

    expect(usesBottomTabBar(formFactor, isLandscape)).toBe(bottomTabs);
    expect(shouldSplitMapLayout(formFactor, isLandscape, 'map-forward', height)).toBe(splitMap);
  });

  it('reserves tab bar height for bottom chrome on every form factor', () => {
    for (const device of DEVICES) {
      const isLandscape = device.width > device.height;
      expect(usesBottomTabBar(device.formFactor, isLandscape)).toBe(true);
      expect(tabBarOccupiedHeight(0, 48)).toBeGreaterThanOrEqual(48);
    }
  });

  it('phones and phablets never split the map (stacked layout + bottom dock)', () => {
    const stacked = DEVICES.filter((d) => d.formFactor !== 'expanded');
    expect(stacked.length).toBeGreaterThan(0);
    for (const device of stacked) {
      const isLandscape = device.width > device.height;
      expect(shouldSplitMapLayout(device.formFactor, isLandscape, 'map-forward', device.height)).toBe(false);
    }
  });

  it('tablet landscape leaves at least 68% of width to the map pane', () => {
    for (const device of DEVICES.filter((d) => d.splitMap)) {
      const panel = resolveMapSplitPanelWidth(device.width, 'map-forward');
      expect(device.width - panel).toBeGreaterThanOrEqual(Math.floor(device.width * 0.68));
    }
  });
});
