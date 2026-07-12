import { tabBarOccupiedHeight, usesBottomTabBar } from '../src/lib/navigation/tabBarGeometry';
import { computeMapChromeLayout } from '../src/features/map/mapChromeLayout';

describe('tabBarGeometry', () => {
  it('always uses bottom tab bar', () => {
    expect(usesBottomTabBar('compact', false)).toBe(true);
    expect(usesBottomTabBar('expanded', true)).toBe(true);
  });

  it('matches AdaptiveTabBar occupied height', () => {
    expect(tabBarOccupiedHeight(34, 48)).toBe(6 + 48 + 34);
    expect(tabBarOccupiedHeight(0, 48)).toBe(6 + 48 + 8);
  });
});

describe('computeMapChromeLayout tab bar inset', () => {
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
    layoutPreset: 'minimal' as const,
    showSideActions: false,
  };

  it('sits instrument dock flush at the screen bottom (tab bar is outside map content)', () => {
    const layout = computeMapChromeLayout({ ...base, tabBarAtBottom: true });
    expect(layout.instrumentDockBottom).toBe(0);
  });

  it('sits instrument dock at safe area when tab bar is a side rail', () => {
    const layout = computeMapChromeLayout({ ...base, tabBarAtBottom: false });
    expect(layout.instrumentDockBottom).toBe(base.chromeBottom + base.spacingSm);
  });
});
