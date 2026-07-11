import { downloadCoordinator, resetDownloadCoordinatorForTests } from '../src/lib/offline/downloadCoordinator';
import { beginDownloadSession, abandonDownloadSession } from '../src/lib/offline/beginDownloadSession';

jest.mock('../src/i18n', () => ({
  t: (key: string) => key,
}));

describe('beginDownloadSession', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
  });

  it('returns a session token when the slot is free', () => {
    expect(beginDownloadSession('kiel-bay')).toBe(1);
    expect(downloadCoordinator.getActiveRegionId()).toBe('kiel-bay');
  });

  it('converts a preflight lock into an active download session', () => {
    downloadCoordinator.preflightLock('kiel-bay');
    expect(beginDownloadSession('kiel-bay')).toBe(1);
    expect(downloadCoordinator.hasPreflightLock('kiel-bay')).toBe(false);
  });

  it('clears a stale preflight lock before starting', () => {
    downloadCoordinator.preflightLock('kiel-bay');
    downloadCoordinator.releasePreflightLock('kiel-bay');
    downloadCoordinator.preflightLock('kiel-bay');
    expect(beginDownloadSession('kiel-bay')).toBe(1);
  });

  it('throws when another region holds the lock', () => {
    downloadCoordinator.preflightLock('other-pack');
    expect(() => beginDownloadSession('kiel-bay')).toThrow('downloads.errorDownloadBusy');
  });

  it('abandonDownloadSession releases a preflight lock only', () => {
    downloadCoordinator.preflightLock('kiel-bay');
    abandonDownloadSession('kiel-bay');
    expect(downloadCoordinator.getActiveRegionId()).toBeNull();
  });

  it('abandonDownloadSession does not end an active download session', () => {
    beginDownloadSession('kiel-bay');
    abandonDownloadSession('kiel-bay');
    expect(downloadCoordinator.getActiveRegionId()).toBe('kiel-bay');
    expect(downloadCoordinator.hasPreflightLock('kiel-bay')).toBe(false);
  });
});
