import NetInfo from '@react-native-community/netinfo';

import { assertChartDownloadNetworkReady, assertNetworkForDownload } from '../src/lib/network/downloadNetwork';
import { resetChartTileProbeCacheForTests } from '../src/lib/network/chartTileReachability';

jest.mock('../src/lib/network/chartTileReachability', () => {
  const actual = jest.requireActual('../src/lib/network/chartTileReachability');
  return {
    ...actual,
    assertChartTileReachability: jest.fn(async () => {}),
  };
});

const assertChartTileReachability = require('../src/lib/network/chartTileReachability')
  .assertChartTileReachability as jest.Mock;

describe('assertNetworkForDownload', () => {
  const fetch = NetInfo.fetch as jest.Mock;

  beforeEach(() => {
    fetch.mockReset();
  });

  it('allows connected network with unknown reachability', async () => {
    fetch.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    await expect(assertNetworkForDownload()).resolves.toBeUndefined();
  });

  it('blocks when disconnected', async () => {
    fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(assertNetworkForDownload()).rejects.toThrow(/internet/i);
  });

  it('allows connected network when reachability probe failed', async () => {
    fetch.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    await expect(assertNetworkForDownload()).resolves.toBeUndefined();
  });
});

describe('assertChartDownloadNetworkReady', () => {
  const fetch = NetInfo.fetch as jest.Mock;

  beforeEach(() => {
    fetch.mockReset();
    resetChartTileProbeCacheForTests();
    assertChartTileReachability.mockClear();
    assertChartTileReachability.mockResolvedValue(undefined);
  });

  it('runs NetInfo and tile reachability checks', async () => {
    fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    await expect(assertChartDownloadNetworkReady()).resolves.toBeUndefined();
    expect(assertChartTileReachability).toHaveBeenCalled();
  });

  it('skips tile probe when offline', async () => {
    fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(assertChartDownloadNetworkReady()).rejects.toThrow(/internet/i);
    expect(assertChartTileReachability).not.toHaveBeenCalled();
  });
});
