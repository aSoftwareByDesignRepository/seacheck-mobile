import { packStateFromNative } from '../src/store/offlinePackStore';
import { pointCoveredByReadyPacks } from '../src/lib/map/coverage';
import { REGION_PACKS } from '../src/map/regionPacks';

describe('packStateFromNative', () => {
  it('maps complete to ready', () => {
    expect(packStateFromNative({ state: 'complete', percentage: 100 } as never)).toBe('ready');
  });

  it('maps active to downloading', () => {
    expect(packStateFromNative({ state: 'active', percentage: 42 } as never)).toBe('downloading');
  });

  it('maps inactive partial download to downloading', () => {
    expect(packStateFromNative({ state: 'inactive', percentage: 55 } as never)).toBe('downloading');
  });

  it('maps inactive empty pack to idle', () => {
    expect(packStateFromNative({ state: 'inactive', percentage: 0 } as never)).toBe('idle');
  });

  it('maps complete at 100 percent to ready', () => {
    expect(packStateFromNative({ state: 'inactive', percentage: 100 } as never)).toBe('ready');
  });
});

describe('chart coverage at point', () => {
  const kielPack = {
    id: 'kiel-bay',
    label: 'Kiel',
    bounds: REGION_PACKS[0].bounds,
    ready: true,
  };

  it('covers position inside downloaded pack', () => {
    const hits = pointCoveredByReadyPacks(54.32, 10.14, [kielPack]);
    expect(hits).toContain('Kiel');
  });

  it('does not cover position far outside downloaded pack', () => {
    const hits = pointCoveredByReadyPacks(58.0, 12.0, [kielPack]);
    expect(hits).toHaveLength(0);
  });
});
