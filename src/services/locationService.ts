import * as Location from 'expo-location';
import { create } from 'zustand';

import { msToKnots, LOW_SOG_KN } from '../lib/geo/navigation';

export type LocationFix = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMs: number | null;
  speedKn: number | null;
  accuracyM: number | null;
  altitudeM: number | null;
  timestamp: number;
};

export type LocationPermissionState = 'undetermined' | 'foreground' | 'background' | 'denied';

type LocationStore = {
  permission: LocationPermissionState;
  fix: LocationFix | null;
  lastGoodFix: LocationFix | null;
  error: string | null;
  watching: boolean;
  refreshPermission: () => Promise<void>;
  startWatching: () => Promise<boolean>;
  stopWatching: () => void;
};

let subscription: Location.LocationSubscription | null = null;

function mapLocation(loc: Location.LocationObject): LocationFix {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    heading: loc.coords.heading,
    speedMs: loc.coords.speed,
    speedKn: msToKnots(loc.coords.speed),
    accuracyM: loc.coords.accuracy,
    altitudeM: loc.coords.altitude,
    timestamp: loc.timestamp,
  };
}

async function resolvePermission(): Promise<LocationPermissionState> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return fg.status === 'denied' ? 'denied' : 'undetermined';
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') return 'background';
  return 'foreground';
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  permission: 'undetermined',
  fix: null,
  lastGoodFix: null,
  error: null,
  watching: false,

  refreshPermission: async () => {
    set({ permission: await resolvePermission() });
  },

  startWatching: async () => {
    if (get().watching) return true;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      set({ permission: 'denied', error: 'permission_denied' });
      return false;
    }
    set({ permission: await resolvePermission(), error: null, watching: true });
    subscription?.remove();
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const fix = mapLocation(loc);
        set({ fix, lastGoodFix: fix, error: null });
      },
    );
    return true;
  },

  stopWatching: () => {
    subscription?.remove();
    subscription = null;
    set({ watching: false });
  },
}));

export function isFixStale(fix: LocationFix | null, maxAgeMs = 30_000): boolean {
  if (!fix) return true;
  return Date.now() - fix.timestamp > maxAgeMs;
}

export function displayCog(fix: LocationFix | null): number | null {
  if (!fix) return null;
  const kn = fix.speedKn ?? 0;
  if (kn < LOW_SOG_KN) return null;
  if (fix.heading != null && !Number.isNaN(fix.heading)) return ((fix.heading % 360) + 360) % 360;
  return null;
}

export function isLowSog(fix: LocationFix | null): boolean {
  return (fix?.speedKn ?? 0) < LOW_SOG_KN;
}
