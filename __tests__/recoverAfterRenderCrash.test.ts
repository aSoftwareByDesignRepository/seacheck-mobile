import { cancelAllPendingConfirms } from '../src/store/confirmStore';
import {
  downloadCoordinator,
  resetDownloadCoordinatorForTests,
} from '../src/lib/offline/downloadCoordinator';
import { recoverAfterRenderCrash } from '../src/shell/recoverAfterRenderCrash';

const mockCancelDownload = jest.fn(async () => {});

jest.mock('../src/store/confirmStore', () => ({
  cancelAllPendingConfirms: jest.fn(),
}));

jest.mock('../src/store/offlinePackStore', () => ({
  useOfflinePackStore: {
    getState: () => ({
      cancelDownload: (...args: unknown[]) => mockCancelDownload(...args),
    }),
  },
}));

describe('recoverAfterRenderCrash', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
    mockCancelDownload.mockClear();
    (cancelAllPendingConfirms as jest.Mock).mockClear();
  });

  it('drains confirms and cancels exclusive download session', async () => {
    expect(downloadCoordinator.tryBegin('kiel-bay')).toBe(1);
    await recoverAfterRenderCrash();
    expect(cancelAllPendingConfirms).toHaveBeenCalledTimes(1);
    expect(mockCancelDownload).toHaveBeenCalledWith('kiel-bay');
  });

  it('still drains confirms when no download is active', async () => {
    await recoverAfterRenderCrash();
    expect(cancelAllPendingConfirms).toHaveBeenCalledTimes(1);
    expect(mockCancelDownload).not.toHaveBeenCalled();
  });

  it('force-invalidates when cancelDownload throws', async () => {
    const token = downloadCoordinator.tryBegin('broken')!;
    mockCancelDownload.mockRejectedValueOnce(new Error('native boom'));
    await recoverAfterRenderCrash();
    expect(downloadCoordinator.isStale('broken', token)).toBe(true);
    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
  });
});
