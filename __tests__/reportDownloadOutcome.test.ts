import { reportDownloadOutcome } from '../src/lib/offline/reportDownloadOutcome';
import { useOfflinePackStore } from '../src/store/offlinePackStore';

describe('reportDownloadOutcome', () => {
  beforeEach(() => {
    useOfflinePackStore.setState({
      regions: {},
      activeDownloadRegionId: null,
    });
  });

  it('shows success when pack is ready without error', () => {
    const showInfo = jest.fn();
    const showError = jest.fn();
    useOfflinePackStore.setState({
      regions: {
        'kiel-bay': { regionId: 'kiel-bay', state: 'ready', percentage: 100, packId: 'p1', error: null },
      },
    });
    reportDownloadOutcome('kiel-bay', { showInfo, showError });
    expect(showInfo).toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows started when download is still active', () => {
    const showInfo = jest.fn();
    const showError = jest.fn();
    useOfflinePackStore.setState({
      activeDownloadRegionId: 'kiel-bay',
      regions: {
        'kiel-bay': { regionId: 'kiel-bay', state: 'downloading', percentage: 5, packId: 'p1', error: null },
      },
    });
    reportDownloadOutcome('kiel-bay', { showInfo, showError });
    expect(showInfo).toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('does not toast errors — async failures use useDownloadFailureAlerts', () => {
    const showInfo = jest.fn();
    const showError = jest.fn();
    useOfflinePackStore.setState({
      regions: {
        'kiel-bay': {
          regionId: 'kiel-bay',
          state: 'error',
          percentage: 0,
          packId: null,
          error: 'No connection',
        },
      },
    });
    reportDownloadOutcome('kiel-bay', { showInfo, showError });
    expect(showInfo).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });
});
