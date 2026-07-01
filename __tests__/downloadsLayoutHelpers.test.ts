import { corridorGroupNeedsAttention, countNonIdlePacks } from '../src/features/downloads/downloadsLayoutHelpers';
import { REGION_PACKS } from '../src/map/regionPacks';

describe('downloadsLayoutHelpers', () => {
  it('detects corridor groups that need attention', () => {
    const p1 = REGION_PACKS.filter((p) => p.priority === 'P1');
    expect(corridorGroupNeedsAttention(p1, {})).toBe(false);
    expect(
      corridorGroupNeedsAttention(p1, {
        [p1[0]!.id]: { regionId: p1[0]!.id, state: 'downloading', percentage: 10, packId: 'x', error: null },
      }),
    ).toBe(true);
  });

  it('counts non-idle packs in a group', () => {
    const p0 = REGION_PACKS.filter((p) => p.priority === 'P0').slice(0, 2);
    expect(countNonIdlePacks(p0, {})).toBe(0);
    expect(
      countNonIdlePacks(p0, {
        [p0[0]!.id]: { regionId: p0[0]!.id, state: 'ready', percentage: 100, packId: 'x', error: null },
        [p0[1]!.id]: { regionId: p0[1]!.id, state: 'idle', percentage: 0, packId: null, error: null },
      }),
    ).toBe(1);
  });
});
