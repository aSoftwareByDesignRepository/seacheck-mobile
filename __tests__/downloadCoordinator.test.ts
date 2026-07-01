import {
  downloadCoordinator,
  formatDownloadError,
  loadNativePacksWithRetry,
  resetDownloadCoordinatorForTests,
} from '../src/lib/offline/downloadCoordinator';

describe('downloadCoordinator', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
  });

  it('allows only one active download at a time', () => {
    expect(downloadCoordinator.tryBegin('a')).toBe(1);
    expect(downloadCoordinator.tryBegin('b')).toBeNull();
    expect(downloadCoordinator.tryBegin('a')).toBeNull();
    downloadCoordinator.end('a');
    expect(downloadCoordinator.tryBegin('b')).toBe(1);
  });

  it('invalidates stale callbacks', () => {
    const token = downloadCoordinator.tryBegin('a')!;
    downloadCoordinator.invalidate('a');
    expect(downloadCoordinator.isStale('a', token)).toBe(true);
  });

  it('restores active lock after app restart', () => {
    downloadCoordinator.end('a');
    expect(downloadCoordinator.restoreActive('a')).toBe(true);
    expect(downloadCoordinator.getActiveRegionId()).toBe('a');
    expect(downloadCoordinator.tryBegin('b')).toBeNull();
    downloadCoordinator.end('a');
  });

  it('preflight lock keeps slot for same region then converts on tryBegin', () => {
    expect(downloadCoordinator.preflightLock('a')).toBe(true);
    expect(downloadCoordinator.hasActiveDownload()).toBe(true);
    expect(downloadCoordinator.tryBegin('b')).toBeNull();
    expect(downloadCoordinator.tryBegin('a')).toBe(1);
    expect(downloadCoordinator.tryBegin('a')).toBeNull();
    downloadCoordinator.end('a');
  });

  it('releasePreflightLock clears slot without a session', () => {
    expect(downloadCoordinator.preflightLock('kiel-bay')).toBe(true);
    downloadCoordinator.releasePreflightLock('kiel-bay');
    expect(downloadCoordinator.hasActiveDownload()).toBe(false);
    expect(downloadCoordinator.tryBegin('kiel-bay')).toBe(1);
    downloadCoordinator.end('kiel-bay');
  });
});

describe('formatDownloadError', () => {
  it('falls back when message missing', () => {
    expect(formatDownloadError({}, 'fallback')).toBe('fallback');
    expect(formatDownloadError(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('reads message from native offline error payloads', () => {
    expect(formatDownloadError({ id: 'p1', message: 'Mapbox tile limit exceeded 6000' }, 'fallback')).toBe(
      'Mapbox tile limit exceeded 6000',
    );
  });
});

describe('loadNativePacksWithRetry', () => {
  it('retries before giving up', async () => {
    let calls = 0;
    const result = await loadNativePacksWithRetry(async () => {
      calls += 1;
      if (calls < 2) throw new Error('fail');
      return [{ id: 'p1' }];
    }, 3, 0);
    expect(result.ok).toBe(true);
    expect(result.packs).toHaveLength(1);
    expect(calls).toBe(2);
  });
});
