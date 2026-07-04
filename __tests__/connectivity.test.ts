import { fetchNetInfoState, isEffectivelyOffline, isEffectivelyOnline } from '../src/lib/network/connectivity';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

const NetInfo = require('@react-native-community/netinfo').default as {
  fetch: jest.Mock;
};

describe('connectivity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    NetInfo.fetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('treats disconnected as offline', () => {
    expect(isEffectivelyOffline({ isConnected: false, isInternetReachable: true })).toBe(true);
  });

  it('treats unreachable internet as offline', () => {
    expect(isEffectivelyOffline({ isConnected: true, isInternetReachable: false })).toBe(true);
  });

  it('does not treat unknown reachability as offline', () => {
    expect(isEffectivelyOffline({ isConnected: true, isInternetReachable: null })).toBe(false);
  });

  it('requires connected reachable internet for online operations', () => {
    expect(isEffectivelyOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isEffectivelyOnline({ isConnected: true, isInternetReachable: null })).toBe(false);
    expect(isEffectivelyOnline({ isConnected: false, isInternetReachable: true })).toBe(false);
  });

  it('returns null when NetInfo.fetch exceeds the timeout budget', async () => {
    NetInfo.fetch.mockReturnValue(new Promise(() => {}));
    const pending = fetchNetInfoState(500);
    jest.advanceTimersByTime(500);
    await expect(pending).resolves.toBeNull();
  });
});
