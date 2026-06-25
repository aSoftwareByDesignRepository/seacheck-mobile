import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Conservative offline detection for safety banners and skipping network calls.
 * Treats unknown reachability as online so we do not hide warnings on flaky NetInfo startup.
 */
export function isEffectivelyOffline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Whether network-backed operations (tile download, Overpass) may proceed. */
export function isEffectivelyOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected === true && state.isInternetReachable === true;
}

export async function fetchIsEffectivelyOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isEffectivelyOffline(state);
}

export async function fetchIsEffectivelyOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isEffectivelyOnline(state);
}

/** Reactive offline flag for map banners and UI gating. */
export function useIsEffectivelyOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const apply = (state: NetInfoState) => setOffline(isEffectivelyOffline(state));
    void NetInfo.fetch().then(apply);
    return NetInfo.addEventListener(apply);
  }, []);

  return offline;
}
