import { downloadCoordinator, resetDownloadCoordinatorForTests } from '../src/lib/offline/downloadCoordinator';
import { waitForDownloadSessionKickoff } from '../src/lib/offline/waitForDownloadSessionKickoff';
import { useOfflinePackStore } from '../src/store/offlinePackStore';

describe('waitForDownloadSessionKickoff', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
    useOfflinePackStore.setState({
      regions: {},
      activeDownloadRegionId: null,
      downloadMapTeardownRegionId: null,
    });
  });

  afterEach(() => {
    resetDownloadCoordinatorForTests();
  });

  it('resolves started once the exclusive session begins (not preflight)', async () => {
    const regionId = 'custom_test';
    downloadCoordinator.preflightLock(regionId);

    let resolveDownload!: () => void;
    const downloadPromise = new Promise<void>((resolve) => {
      resolveDownload = resolve;
    });

    const wait = waitForDownloadSessionKickoff(regionId, downloadPromise, 5_000);

    // Still preflight — must not resolve yet.
    let settled = false;
    void wait.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    downloadCoordinator.tryBegin(regionId);
    useOfflinePackStore.setState({
      activeDownloadRegionId: regionId,
      regions: {
        [regionId]: {
          regionId,
          state: 'downloading',
          percentage: 0,
          packId: null,
          error: null,
          downloadInitializing: true,
        },
      },
    });

    await expect(wait).resolves.toBe('started');
    resolveDownload();
  });

  it('resolves finished when the download promise completes before kickoff poll', async () => {
    const regionId = 'custom_fast';
    const downloadPromise = Promise.resolve();
    await expect(waitForDownloadSessionKickoff(regionId, downloadPromise, 5_000)).resolves.toBe('finished');
  });

  it('rejects when the download promise fails before the session starts', async () => {
    const regionId = 'custom_fail';
    const downloadPromise = Promise.reject(new Error('storage full'));
    await expect(waitForDownloadSessionKickoff(regionId, downloadPromise, 5_000)).rejects.toThrow('storage full');
  });

  it('ignores preflight-only activeDownloadRegionId', async () => {
    const regionId = 'custom_preflight';
    downloadCoordinator.preflightLock(regionId);
    useOfflinePackStore.setState({ activeDownloadRegionId: regionId });

    let resolveDownload!: () => void;
    const downloadPromise = new Promise<void>((resolve) => {
      resolveDownload = resolve;
    });

    const wait = waitForDownloadSessionKickoff(regionId, downloadPromise, 200);
    await expect(wait).rejects.toThrow('Download session did not start in time');
    resolveDownload();
  });
});
