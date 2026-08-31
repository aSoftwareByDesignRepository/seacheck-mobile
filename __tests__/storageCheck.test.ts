import * as FileSystem from 'expo-file-system/legacy';

import { ensureStorageForDownload } from '../src/lib/offline/storageCheck';

jest.mock('expo-file-system/legacy', () => ({
  getFreeDiskStorageAsync: jest.fn(),
}));

describe('ensureStorageForDownload', () => {
  const getFree = FileSystem.getFreeDiskStorageAsync as jest.Mock;

  beforeEach(() => {
    getFree.mockReset();
  });

  it('allows when enough free space', async () => {
    getFree.mockResolvedValue(2 * 1024 * 1024 * 1024);
    await expect(ensureStorageForDownload(10_000)).resolves.toEqual({ ok: true });
  });

  it('blocks when storage is tight', async () => {
    getFree.mockResolvedValue(40 * 1024 * 1024);
    await expect(ensureStorageForDownload(50_000)).resolves.toEqual({ ok: false, reason: 'insufficient' });
  });

  it('fails closed when free space cannot be read', async () => {
    getFree.mockRejectedValue(new Error('unavailable'));
    await expect(ensureStorageForDownload(50_000)).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });

  it('fails closed when free-space API is missing', async () => {
    const original = FileSystem.getFreeDiskStorageAsync;
    // @ts-expect-error test override
    FileSystem.getFreeDiskStorageAsync = undefined;
    try {
      await expect(ensureStorageForDownload(50_000)).resolves.toEqual({ ok: false, reason: 'unavailable' });
    } finally {
      // @ts-expect-error restore
      FileSystem.getFreeDiskStorageAsync = original;
    }
  });

  it('fails closed when estimate is missing or non-positive', async () => {
    await expect(ensureStorageForDownload(0)).resolves.toEqual({ ok: false, reason: 'unavailable' });
    await expect(ensureStorageForDownload(-1)).resolves.toEqual({ ok: false, reason: 'unavailable' });
    await expect(ensureStorageForDownload(Number.NaN)).resolves.toEqual({ ok: false, reason: 'unavailable' });
    expect(getFree).not.toHaveBeenCalled();
  });
});
