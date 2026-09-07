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

  it('cancels teardown on invalidate when region never held exclusivity', () => {
    // invalidate of a non-owner must not invent teardown.
    downloadCoordinator.invalidate('kiel-bay');
    expect(downloadCoordinator.getTeardownRegionId()).toBeNull();
  });

  it('keeps GL teardown exclusivity after invalidate of an active session (cancel path)', () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.invalidate('kiel-bay');
    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
    expect(downloadCoordinator.getTeardownRegionId()).toBe('kiel-bay');
    expect(downloadCoordinator.tryBegin('laboe-bight')).toBeNull();
    expect(downloadCoordinator.restoreActive('laboe-bight')).toBe(false);
  });

  it('restoreActive refuses while teardown still owns the TextureView', () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');
    expect(downloadCoordinator.restoreActive('kiel-bay')).toBe(false);
    expect(downloadCoordinator.restoreActive('laboe-bight')).toBe(false);
    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
  });

  it('resolves waitForDownloadMapTeardown when teardown clears before the listener attaches', async () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(5_000);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');
    expect(downloadCoordinator.getTeardownRegionId()).toBe('kiel-bay');

    // Clear teardown synchronously after wait starts — the re-check after subscribe must catch it.
    const wait = waitForDownloadMapTeardown('kiel-bay', 200);
    downloadCoordinator.cancelMapTeardown('kiel-bay');
    await expect(wait).resolves.toBeUndefined();
  });

  it('blocks tryBegin and preflightLock while GL teardown still owns the TextureView', () => {
    jest.spyOn(downloadMapConstants, 'downloadMapPostTeardownMs').mockReturnValue(40);

    downloadCoordinator.tryBegin('kiel-bay');
    downloadCoordinator.beginMapTeardown('kiel-bay');
    expect(downloadCoordinator.getTeardownRegionId()).toBe('kiel-bay');

    expect(downloadCoordinator.tryBegin('laboe-bight')).toBeNull();
    expect(downloadCoordinator.preflightLock('laboe-bight')).toBe(false);
    expect(downloadCoordinator.tryBegin('kiel-bay')).toBeNull();
    expect(downloadCoordinator.preflightLock('kiel-bay')).toBe(false);
  });
});
