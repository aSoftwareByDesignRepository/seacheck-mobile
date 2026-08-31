import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';

describe('offlinePackStore preflight UI', () => {
  beforeEach(() => {
    resetOfflinePackStoreForTests();
  });

  afterEach(() => {
    downloadCoordinator.invalidate('kiel-bay');
  });

  it('shows downloading+initializing immediately when preflight lock is acquired', () => {
    expect(useOfflinePackStore.getState().preflightDownloadLock('kiel-bay')).toBe(true);
    const snap = useOfflinePackStore.getState();
    expect(snap.activeDownloadRegionId).toBe('kiel-bay');
    expect(snap.regions['kiel-bay']?.state).toBe('downloading');
    expect(snap.regions['kiel-bay']?.downloadInitializing).toBe(true);
    expect(snap.regions['kiel-bay']?.percentage).toBe(0);
  });

  it('reverts to idle when preflight lock is released before download starts', () => {
    useOfflinePackStore.getState().preflightDownloadLock('kiel-bay');
    useOfflinePackStore.getState().releasePreflightDownloadLock('kiel-bay');
    const snap = useOfflinePackStore.getState();
    expect(snap.activeDownloadRegionId).toBeNull();
    expect(snap.regions['kiel-bay']?.state).toBe('idle');
  });

  it('marks preflight-only downloading as error on failure', () => {
    useOfflinePackStore.getState().preflightDownloadLock('kiel-bay');
    useOfflinePackStore.getState().markPreflightDownloadFailed('kiel-bay', 'Tile probe failed');
    const status = useOfflinePackStore.getState().regions['kiel-bay'];
    expect(status?.state).toBe('error');
    expect(status?.error).toBe('Tile probe failed');
  });
});
