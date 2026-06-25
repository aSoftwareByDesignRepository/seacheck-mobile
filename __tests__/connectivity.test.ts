import { isEffectivelyOffline, isEffectivelyOnline } from '../src/lib/network/connectivity';

describe('connectivity', () => {
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
});
