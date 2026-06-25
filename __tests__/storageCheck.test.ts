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

  it('fails open when free space cannot be read', async () => {
    getFree.mockRejectedValue(new Error('unavailable'));
    await expect(ensureStorageForDownload(50_000)).resolves.toEqual({ ok: true });
  });
});
