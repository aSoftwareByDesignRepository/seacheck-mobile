import * as Location from 'expo-location';

export type LocationPermissionState = 'undetermined' | 'foreground' | 'background' | 'denied';

export type LocationAccessResult = {
  status: Location.PermissionStatus;
  /** OS will not show the permission dialog again — user must open Settings. */
  blocked: boolean;
};

export type LocationPermissionSnapshot = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
  foregroundCanAskAgain: boolean;
  backgroundCanAskAgain: boolean;
  /** iOS reduced accuracy or Android coarse/none — anchor-grade GPS may be degraded. */
  reducedAccuracy: boolean;
};

export function isLocationPermissionBlocked(response: {
  status: Location.PermissionStatus;
  canAskAgain: boolean;
}): boolean {
  return response.status === 'denied' && response.canAskAgain === false;
}

export function isReducedLocationAccuracy(fg: Location.LocationPermissionResponse): boolean {
  if (fg.ios?.accuracy === 'reduced') return true;
  const androidAccuracy = fg.android?.accuracy;
  return androidAccuracy === 'coarse' || androidAccuracy === 'none';
}

export function mapSnapshotToPermissionState(snapshot: LocationPermissionSnapshot): LocationPermissionState {
  if (snapshot.foreground !== 'granted') {
    return snapshot.foreground === 'denied' ? 'denied' : 'undetermined';
  }
  if (snapshot.background === 'granted') return 'background';
  return 'foreground';
}

export async function readLocationPermissionSnapshot(): Promise<LocationPermissionSnapshot> {
  const [foregroundResponse, backgroundResponse] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    foreground: foregroundResponse.status,
    background: backgroundResponse.status,
    foregroundCanAskAgain: foregroundResponse.canAskAgain,
    backgroundCanAskAgain: backgroundResponse.canAskAgain,
    reducedAccuracy: isReducedLocationAccuracy(foregroundResponse),
  };
}
