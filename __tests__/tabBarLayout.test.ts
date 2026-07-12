import { navigationRailOccupiedWidth, RAIL_WIDTH } from '../src/navigation/tabBarLayout';

describe('tabBarLayout', () => {
  it('computes fixed navigation rail width including safe-area inset', () => {
    expect(navigationRailOccupiedWidth(0)).toBe(RAIL_WIDTH);
    expect(navigationRailOccupiedWidth(24)).toBe(RAIL_WIDTH + 24);
  });
});
