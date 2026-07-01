import { FULL_TAB_BAR_WIDTH, resolveBottomTabLayout } from '../src/navigation/tabBarLayout';

describe('resolveBottomTabLayout', () => {
  it('shows all tabs on wide screens', () => {
    const layout = resolveBottomTabLayout(FULL_TAB_BAR_WIDTH);
    expect(layout.visible).toHaveLength(5);
    expect(layout.overflow).toHaveLength(0);
  });

  it('overflows Downloads and Settings on compact phones', () => {
    const layout = resolveBottomTabLayout(360);
    expect(layout.visible).toEqual(['Map', 'Passage', 'Tracks']);
    expect(layout.overflow).toEqual(['Downloads', 'Settings']);
  });
});
