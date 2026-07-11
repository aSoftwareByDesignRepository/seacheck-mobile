import { legOverrideKey } from '../src/lib/passage/computeLegs';
import { remapActiveLegIndexAfterReversal, remapLegOverridesForReversal } from '../src/lib/passage/reversePassageOrder';

describe('reversePassageOrder', () => {
  it('remaps active leg index when route is reversed', () => {
    expect(remapActiveLegIndexAfterReversal(4, 0)).toBe(2);
    expect(remapActiveLegIndexAfterReversal(4, 1)).toBe(1);
    expect(remapActiveLegIndexAfterReversal(4, 2)).toBe(0);
  });

  it('swaps leg override direction for reversed waypoint order', () => {
    const remapped = remapLegOverridesForReversal(['a', 'b', 'c'], {
      [legOverrideKey('a', 'b')]: { sogKn: 3, note: 'slow' },
      [legOverrideKey('b', 'c')]: { note: 'watch traffic' },
    });
    expect(remapped).toEqual([
      { fromWaypointId: 'b', toWaypointId: 'a', patch: { sogKn: 3, note: 'slow' } },
      { fromWaypointId: 'c', toWaypointId: 'b', patch: { note: 'watch traffic' } },
    ]);
  });
});
