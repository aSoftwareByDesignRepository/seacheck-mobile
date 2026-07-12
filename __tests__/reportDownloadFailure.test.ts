import NetInfo from '@react-native-community/netinfo';

import { buildDownloadFailureReport } from '../src/lib/offline/buildDownloadFailureReport';
import {
  formatThrowable,
  reportDownloadFailure,
  reportDownloadFailureFromThrowable,
} from '../src/lib/offline/reportDownloadFailure';
import { useDownloadFailureStore } from '../src/store/downloadFailureStore';
import { useOfflinePackStore } from '../src/store/offlinePackStore';
import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

describe('buildDownloadFailureReport', () => {
  beforeEach(() => {
    useOfflinePackStore.setState({
      hydrated: true,
      chartStyleUri: 'file:///style.json',
      activeDownloadRegionId: null,
      customBoundsIndex: {},
      regions: {
        'kiel-bay': {
          regionId: 'kiel-bay',
          state: 'error',
          percentage: 12,
          packId: null,
          error: 'No connection',
        },
      },
    });
    useSettingsStore.setState({ downloadWifiOnly: true });
  });

  it('includes pack and network context', async () => {
    const report = await buildDownloadFailureReport({
      regionId: 'kiel-bay',
      message: 'No connection',
      source: 'async',
      extra: { phase: 'completing', stackTrace: 'Error: boom\n    at markReady' },
    });
    expect(report).toMatch(/SeaCheck Download Failure Report/);
    expect(report).toMatch(/regionId=kiel-bay/);
    expect(report).toMatch(/error=No connection/);
    expect(report).toMatch(/downloadWifiOnly=true/);
    expect(report).toMatch(/sessionPhase=completing/);
    expect(report).toMatch(/Stack trace/);
    expect(report).toMatch(/Error: boom/);
    expect(NetInfo.fetch).toHaveBeenCalled();
  });
});

describe('formatThrowable', () => {
  it('preserves Error stack traces', () => {
    const err = new Error('GL teardown failed');
    const formatted = formatThrowable(err);
    expect(formatted.message).toBe('GL teardown failed');
    expect(formatted.stack).toContain('GL teardown failed');
  });
});

describe('reportDownloadFailure', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useDownloadFailureStore.setState({ visible: false, title: '', summary: '', report: '' });
    useOfflinePackStore.setState({
      hydrated: true,
      chartStyleUri: null,
      activeDownloadRegionId: null,
      customBoundsIndex: {},
      regions: {
        'kiel-bay': {
          regionId: 'kiel-bay',
          state: 'error',
          percentage: 0,
          packId: null,
          error: 'Stalled',
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the failure modal with a copyable report', async () => {
    await reportDownloadFailure({ regionId: 'kiel-bay', message: 'Stalled', source: 'async' });
    const state = useDownloadFailureStore.getState();
    expect(state.visible).toBe(true);
    expect(state.report).toMatch(/regionId=kiel-bay/);
    expect(state.summary).toMatch(/Stalled/);
  });

  it('deduplicates identical reports within 3 seconds', async () => {
    await reportDownloadFailure({ regionId: 'kiel-bay', message: 'Stalled', source: 'async' });
    useDownloadFailureStore.getState().dismiss();
    await reportDownloadFailure({ regionId: 'kiel-bay', message: 'Stalled', source: 'async' });
    expect(useDownloadFailureStore.getState().visible).toBe(false);
    jest.advanceTimersByTime(3100);
    await reportDownloadFailure({ regionId: 'kiel-bay', message: 'Stalled', source: 'async' });
    expect(useDownloadFailureStore.getState().visible).toBe(true);
  });

  it('includes stack traces from thrown errors', async () => {
    const err = new Error('Completing phase exploded');
    await reportDownloadFailureFromThrowable('kiel-bay', err, 'async', 'completing');
    const state = useDownloadFailureStore.getState();
    expect(state.visible).toBe(true);
    expect(state.report).toMatch(/sessionPhase=completing/);
    expect(state.report).toMatch(/Completing phase exploded/);
  });
});
