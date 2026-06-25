import * as Location from 'expo-location';
import { create } from 'zustand';

import { computeGpsCogDeg, resolveDisplayCog } from '../lib/geo/cog';
import { distanceNm, msToKnots } from '../lib/geo/navigation';
import { FIX_STALE_MS } from '../lib/geo/fixAge';
import { normalizeFixTimestamp } from '../lib/geo/fixQuality';

export type LocationFix = {
  latitude: number;
  longitude: number;
  heading: number | null;
  /** GPS-derived course from successive fixes; null until enough movement. */
  cogDeg: number | null;
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
let lastFixForDerived: LocationFix | null = null;

export function applyBackgroundLocationFix(loc: Location.LocationObject): LocationFix {
  const fix = enrichFix(mapLocation(loc));
  useLocationStore.setState({ fix, lastGoodFix: fix, error: null });
  return fix;
}

function mapLocation(loc: Location.LocationObject): Omit<LocationFix, 'cogDeg'> {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    heading: loc.coords.heading,
    speedMs: loc.coords.speed,
    speedKn: msToKnots(loc.coords.speed),
    accuracyM: loc.coords.accuracy,
    altitudeM: loc.coords.altitude,
    timestamp: normalizeFixTimestamp(loc.timestamp),
  };
}

function enrichFix(raw: Omit<LocationFix, 'cogDeg'>): LocationFix {
  let cogDeg: number | null = null;
  if (lastFixForDerived) {
    cogDeg = computeGpsCogDeg(lastFixForDerived, raw);
  }
  const fix: LocationFix = {
    ...raw,
    cogDeg: cogDeg ?? lastFixForDerived?.cogDeg ?? null,
  };

  if (lastFixForDerived) {
    const seg = distanceNm(
      [lastFixForDerived.longitude, lastFixForDerived.latitude],
      [fix.longitude, fix.latitude],
    );
    if (seg > 0.001 && seg < 2 && (fix.speedKn ?? 0) > 0.3) {
      void import('../store/navigationStore').then(({ useNavigationStore }) => {
        void useNavigationStore.getState().addSessionDistanceNm(seg);
      });
    }
  }

  lastFixForDerived = fix;
  return fix;
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
    try {
      let fg = await Location.getForegroundPermissionsAsync();
      if (fg.status === Location.PermissionStatus.UNDETERMINED) {
        fg = await Location.requestForegroundPermissionsAsync();
      }
      if (fg.status !== Location.PermissionStatus.GRANTED) {
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
          const fix = enrichFix(mapLocation(loc));
          set({ fix, lastGoodFix: fix, error: null });
        },
      );
      return true;
    } catch (error) {
      console.warn('[locationService] startWatching failed', error);
      subscription?.remove();
      subscription = null;
      set({ watching: false, error: 'watch_failed' });
      return false;
    }
  },

  stopWatching: () => {
    subscription?.remove();
    subscription = null;
    lastFixForDerived = null;
    set({ watching: false });
  },
}));

export function isFixStale(fix: LocationFix | null, maxAgeMs = FIX_STALE_MS): boolean {
  if (!fix) return true;
  if (!Number.isFinite(fix.timestamp)) return true;
  return Date.now() - fix.timestamp > maxAgeMs;
}

export function displayHeading(fix: LocationFix | null): number | null {
  if (!fix || fix.heading == null || Number.isNaN(fix.heading)) return null;
  return ((fix.heading % 360) + 360) % 360;
}

export function displayCog(fix: LocationFix | null): number | null {
  return resolveDisplayCog(fix);
}

export function isLowSog(fix: LocationFix | null): boolean {
  return (fix?.speedKn ?? 0) < 2;
}
