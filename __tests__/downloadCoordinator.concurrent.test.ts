import {
  downloadCoordinator,
  resetDownloadCoordinatorForTests,
} from '../src/lib/offline/downloadCoordinator';

describe('downloadCoordinator concurrency', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
  });

  it('Promise.all double tryBegin grants exactly one session', async () => {
    const [a, b] = await Promise.all([
      Promise.resolve(downloadCoordinator.tryBegin('kiel-bay')),
      Promise.resolve(downloadCoordinator.tryBegin('laboe-bight')),
    ]);
    const tokens = [a, b].filter((t) => t != null);
    expect(tokens).toHaveLength(1);
    expect(downloadCoordinator.hasActiveDownload()).toBe(true);
    expect(downloadCoordinator.getActiveRegionId()).toMatch(/kiel-bay|laboe-bight/);
  });
});
