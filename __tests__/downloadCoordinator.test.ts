import {
  downloadCoordinator,
  formatDownloadError,
  loadNativePacksWithRetry,
} from '../src/lib/offline/downloadCoordinator';

describe('downloadCoordinator', () => {
  beforeEach(() => {
    downloadCoordinator.end('a');
    downloadCoordinator.end('b');
  });

  it('allows only one active download at a time', () => {
    expect(downloadCoordinator.tryBegin('a')).toBe(1);
    expect(downloadCoordinator.tryBegin('b')).toBeNull();
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
});

describe('formatDownloadError', () => {
  it('falls back when message missing', () => {
    expect(formatDownloadError({}, 'fallback')).toBe('fallback');
    expect(formatDownloadError(new Error('boom'), 'fallback')).toBe('boom');
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
