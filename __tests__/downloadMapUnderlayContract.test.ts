import { downloadCoordinator, resetDownloadCoordinatorForTests } from '../src/lib/offline/downloadCoordinator';
import { hasExclusiveChartDownloadMap, isDownloadMapSessionActive } from '../src/features/downloads/packDownloadPresentation';
import { useOfflinePackStore } from '../src/store/offlinePackStore';

/**
 * Documents the BootGate layering contract that prevents the Android download
 * TextureView from blacking out every tab (touches still worked via pointerEvents none).
 */
describe('download map underlay contract', () => {
  beforeEach(() => {
    resetDownloadCoordinatorForTests();
    useOfflinePackStore.setState({
      activeDownloadRegionId: null,
      downloadMapTeardownRegionId: null,
      regions: {},
    });
  });

  it('treats an active download as an exclusive chart session needing global chrome', () => {
    downloadCoordinator.tryBegin('kiel-bay');
    useOfflinePackStore.setState({
      activeDownloadRegionId: 'kiel-bay',
      regions: {
        'kiel-bay': {
          regionId: 'kiel-bay',
          state: 'downloading',
          percentage: 12,
          packId: null,
          error: null,
        },
      },
    });

    expect(hasExclusiveChartDownloadMap('kiel-bay', null)).toBe(true);
    expect(
      isDownloadMapSessionActive('kiel-bay', { state: 'downloading' }, 'kiel-bay', null),
    ).toBe(true);
  });

  it('does not treat preflight-only locks as exclusive GL sessions', () => {
    downloadCoordinator.preflightLock('kiel-bay');
    expect(hasExclusiveChartDownloadMap('kiel-bay', null)).toBe(true);
    expect(
      isDownloadMapSessionActive('kiel-bay', { state: 'idle' }, 'kiel-bay', null),
    ).toBe(false);
  });
});
