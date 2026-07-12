import {
  downloadCoordinator,
  resetDownloadCoordinatorForTests,
  waitForDownloadMapTeardown,
} from '../src/lib/offline/downloadCoordinator';
import * as downloadMapConstants from '../src/lib/offline/downloadMapConstants';

describe('downloadCoordinator map teardown', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
    jest.restoreAllMocks();
  });

  it('skips teardown delay under the Jest runtime (store tests stay fast)', () => {
    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');

    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
    expect(downloadCoordinator.getTeardownRegionId()).toBeNull();
    expect(downloadCoordinator.hasExclusiveMapSession()).toBe(false);
  });

  it('keeps an exclusive map region during post-session teardown in production timing', async () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');

    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
    expect(downloadCoordinator.getTeardownRegionId()).toBe('kiel-bay');
    expect(downloadCoordinator.getExclusiveMapRegionId()).toBe('kiel-bay');
    expect(downloadCoordinator.hasExclusiveMapSession()).toBe(true);

    await waitForDownloadMapTeardown('kiel-bay', 200);

    expect(downloadCoordinator.getTeardownRegionId()).toBeNull();
    expect(downloadCoordinator.hasExclusiveMapSession()).toBe(false);
  });

  it('cancels teardown on invalidate', () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');
    downloadCoordinator.invalidate('kiel-bay');
    expect(downloadCoordinator.getTeardownRegionId()).toBeNull();
  });
});
