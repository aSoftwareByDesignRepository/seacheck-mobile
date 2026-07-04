import {
  initializingNativePackStatus,
  normalizeNativePackStatus,
  pollNativePackStatus,
  resolveNativePackStatus,
} from '../src/lib/offline/nativePackStatus';
import { isNativeDownloadComplete, packStateFromNative } from '../src/store/offlinePackStore';

describe('normalizeNativePackStatus', () => {
  it('returns null for null/undefined/non-object payloads', () => {
    expect(normalizeNativePackStatus(null)).toBeNull();
    expect(normalizeNativePackStatus(undefined)).toBeNull();
    expect(normalizeNativePackStatus('bad')).toBeNull();
  });

  it('uses packId fallback when native payload omits id', () => {
    expect(
      normalizeNativePackStatus(
        {
          state: 'active',
          percentage: 0,
          completedResourceCount: 0,
          completedResourceSize: 0,
          completedTileCount: 0,
          completedTileSize: 0,
          requiredResourceCount: 1,
        },
        'pack-fallback',
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'pack-fallback',
        state: 'active',
        requiredResourceCount: 1,
      }),
    );
  });

  it('coerces invalid numbers and state values', () => {
    expect(
      normalizeNativePackStatus(
        {
          id: 'pack-1',
          state: 'weird',
          percentage: 'nope',
          completedResourceCount: null,
          requiredResourceCount: Infinity,
        },
        'pack-1',
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'pack-1',
        state: 'inactive',
        percentage: 0,
        completedResourceCount: 0,
        requiredResourceCount: 0,
      }),
    );
  });
});

describe('initializingNativePackStatus', () => {
  it('returns a safe zeroed status object', () => {
    expect(initializingNativePackStatus('pack-init')).toEqual({
      id: 'pack-init',
      state: 'inactive',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 0,
    });
  });
});

describe('resolveNativePackStatus', () => {
  it('falls back to initializing status when native payload is null', () => {
    expect(resolveNativePackStatus(null, 'pack-fallback')).toEqual(initializingNativePackStatus('pack-fallback'));
  });
});

describe('pollNativePackStatus', () => {
  it('times out hung native status reads', async () => {
    jest.useFakeTimers();
    const pack = {
      id: 'pack-hung',
      status: jest.fn(
        () =>
          new Promise(() => {
            /* never settles */
          }),
      ),
    };
    const pending = pollNativePackStatus(pack as never, 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBeNull();
    jest.useRealTimers();
  });
});

describe('null-safe pack state helpers', () => {
  it('packStateFromNative treats null as idle', () => {
    expect(packStateFromNative(null)).toBe('idle');
  });

  it('isNativeDownloadComplete rejects null', () => {
    expect(isNativeDownloadComplete(null)).toBe(false);
  });
});
