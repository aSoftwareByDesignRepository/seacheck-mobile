import {
  countFailedPacks,
  countReadyPacks,
  isPackDownloadActive,
  listFailedPacks,
  packHasDownloadFailure,
  packStatusBadgeVariant,
  packStatusLabel,
  seamarkStatusLabel,
} from '../src/features/downloads/packDownloadPresentation';

describe('packDownloadPresentation', () => {
  it('detects active download from coordinator lock before progress ticks', () => {
    expect(isPackDownloadActive('kiel-bay', { state: 'idle' }, 'kiel-bay')).toBe(true);
    expect(isPackDownloadActive('kiel-bay', { state: 'downloading' }, null)).toBe(true);
    expect(isPackDownloadActive('kiel-bay', { state: 'idle' }, 'other')).toBe(false);
  });

  it('maps pack states to badge variants', () => {
    expect(packStatusBadgeVariant({ state: 'ready' })).toBe('success');
    expect(packStatusBadgeVariant({ state: 'downloading' })).toBe('warning');
    expect(packStatusBadgeVariant({ state: 'error' })).toBe('danger');
    expect(packStatusBadgeVariant({ state: 'idle' })).toBe('neutral');
  });

  it('counts ready packs', () => {
    expect(
      countReadyPacks({
        a: { state: 'ready' },
        b: { state: 'idle' },
        c: { state: 'ready' },
      }),
    ).toBe(2);
  });

  it('returns seamark label only for ready packs', () => {
    expect(seamarkStatusLabel({ state: 'idle', seamarksIndexed: false, seamarksIndexing: false })).toBeNull();
    expect(seamarkStatusLabel({ state: 'ready', seamarksIndexed: true, seamarksIndexing: false })).toMatch(/seamark/i);
  });

  it('formats downloading label with percentage', () => {
    expect(packStatusLabel({ state: 'downloading', percentage: 42 })).toMatch(/42/);
  });

  it('shows initializing label before native enumeration', () => {
    expect(packStatusLabel({ state: 'downloading', percentage: 0, downloadInitializing: true })).toMatch(/prepar/i);
  });

  it('treats ready pack with error as failed', () => {
    expect(packHasDownloadFailure({ state: 'ready', error: 'Network lost' })).toBe(true);
    expect(packStatusLabel({ state: 'ready', percentage: 100, error: 'Network lost' })).toMatch(/failed/i);
    expect(packStatusBadgeVariant({ state: 'ready', error: 'Network lost' })).toBe('danger');
  });

  it('lists failed packs for the status banner', () => {
    const failed = listFailedPacks({
      'kiel-bay': {
        regionId: 'kiel-bay',
        state: 'error',
        percentage: 0,
        packId: null,
        error: 'No connection',
      },
    });
    expect(failed).toHaveLength(1);
    expect(failed[0]?.name).toMatch(/Kieler Bucht/i);
    expect(countFailedPacks({ a: { state: 'error' }, b: { state: 'ready' } })).toBe(1);
  });
});
