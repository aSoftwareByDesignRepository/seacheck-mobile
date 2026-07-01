import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Conservative offline detection for safety banners and skipping network calls.
 * Treats unknown reachability as online so we do not hide warnings on flaky NetInfo startup.
 */
export function isEffectivelyOffline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/**
 * Whether the OS reports no active network interface (airplane mode, etc.).
 * Ignores isInternetReachable — Android often reports false negatives while Wi‑Fi/cellular work.
 */
export function isDeviceDisconnected(state: Pick<NetInfoState, 'isConnected'>): boolean {
  return state.isConnected === false;
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

/** Reactive flag for MapLibre native network — only false when the device has no connection. */
export function useIsDeviceDisconnected(): boolean {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const apply = (state: NetInfoState) => setDisconnected(isDeviceDisconnected(state));
    void NetInfo.fetch().then(apply);
    return NetInfo.addEventListener(apply);
  }, []);

  return disconnected;
}
