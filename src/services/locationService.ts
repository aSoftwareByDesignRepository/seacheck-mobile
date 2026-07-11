import * as Location from 'expo-location';
import { create } from 'zustand';

import { computeGpsCogDeg, resolveDisplayCog } from '../lib/geo/cog';
import {
  buildDisplayFix,
  classifyFixAcceptance,
  effectivePreviousFixForAcceptance,
  smoothGpsPosition,
  type FixAcceptanceReason,
  type GpsSmoothState,
} from '../lib/geo/gpsFilter';
import {
  foregroundGpsOptionsForProfile,
  type ForegroundGpsProfile,
} from '../lib/geo/gpsLocationOptions';
import {
  mapSnapshotToPermissionState,
  readLocationPermissionSnapshot,
  type LocationPermissionSnapshot,
  type LocationPermissionState,
} from '../lib/permissions/locationPermissionState';
import { distanceNm, msToKnots } from '../lib/geo/navigation';
import { FIX_STALE_MS } from '../lib/geo/fixAge';
import { isFixQualityOk, isValidCoordinate, normalizeFixTimestamp } from '../lib/geo/fixQuality';

export type { LocationPermissionState } from '../lib/permissions/locationPermissionState';

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

type StartWatchingOptions = {
  /** When false, never shows the OS permission dialog (boot / resume). Default true. */
  requestIfUndetermined?: boolean;
};

type LocationStore = {
  permission: LocationPermissionState;
  foregroundCanAskAgain: boolean;
  backgroundCanAskAgain: boolean;
  reducedAccuracy: boolean;
  /** Latest raw GPS fix — always updated when coordinates are valid. */
  fix: LocationFix | null;
  /** Map/instruments position — accuracy-smoothed when enabled; falls back to accepted raw. */
  displayFix: LocationFix | null;
  /** Last accepted fix that passed quality gates — used when current fix is stale. */
  lastGoodFix: LocationFix | null;
  /** Why the latest raw fix was not used for navigation smoothing. */
  fixAcceptance: FixAcceptanceReason | null;
  error: string | null;
  watching: boolean;
  watchProfile: ForegroundGpsProfile | null;
  refreshPermission: () => Promise<void>;
  applyPermissionSnapshot: (snapshot: LocationPermissionSnapshot) => void;
  startWatching: (options?: StartWatchingOptions & { profile?: ForegroundGpsProfile }) => Promise<boolean>;
  setWatchProfile: (profile: ForegroundGpsProfile) => Promise<boolean>;
  stopWatching: (options?: { clearFixHistory?: boolean }) => void;
};

let subscription: Location.LocationSubscription | null = null;
let lastAcceptedFix: LocationFix | null = null;
let smoothState: GpsSmoothState | null = null;
let activeWatchProfile: ForegroundGpsProfile | null = null;

function handleWatchLocation(loc: Location.LocationObject, set: (partial: Partial<LocationStore>) => void): void {
  const { useSettingsStore } = require('../store/settingsStore') as typeof import('../store/settingsStore');
  const smoothEnabled = useSettingsStore.getState().gpsSmoothPosition;
  const processed = enrichAndStore(mapLocation(loc), smoothEnabled);
  applyProcessedToStore(processed, set);
}

async function attachWatchSubscription(
  profile: ForegroundGpsProfile,
  set: (partial: Partial<LocationStore>) => void,
  get: () => LocationStore,
): Promise<void> {
  subscription?.remove();
  activeWatchProfile = profile;
  subscription = await Location.watchPositionAsync(foregroundGpsOptionsForProfile(profile), (loc) => {
    handleWatchLocation(loc, set);
  });
  set({ watching: true, watchProfile: profile, error: null });
  void Location.getCurrentPositionAsync(foregroundGpsOptionsForProfile(profile))
    .then((loc) => {
      if (!get().watching || activeWatchProfile !== profile) return;
      handleWatchLocation(loc, set);
    })
    .catch((error) => {
      console.warn('[locationService] seed fix failed', error);
    });
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

type ProcessedFix = {
  fix: LocationFix;
  displayFix: LocationFix | null;
  lastGoodFix: LocationFix | null;
  fixAcceptance: FixAcceptanceReason | null;
};

function processRawFix(raw: Omit<LocationFix, 'cogDeg'>, smoothEnabled: boolean): ProcessedFix | null {
  if (!isValidCoordinate(raw.latitude, raw.longitude)) {
    return null;
  }

  const acceptance = classifyFixAcceptance(effectivePreviousFixForAcceptance(lastAcceptedFix, raw.timestamp), raw);
  const cogDeg =
    acceptance.accepted && lastAcceptedFix
      ? (computeGpsCogDeg(lastAcceptedFix, raw) ?? lastAcceptedFix.cogDeg)
      : (lastAcceptedFix?.cogDeg ?? null);

  const fix: LocationFix = { ...raw, cogDeg };

  let displayFix: LocationFix | null = null;
  let lastGoodFix: LocationFix | null = lastAcceptedFix;

  if (acceptance.accepted) {
    if (lastAcceptedFix) {
      const seg = distanceNm(
        [lastAcceptedFix.longitude, lastAcceptedFix.latitude],
        [fix.longitude, fix.latitude],
      );
      if (seg > 0.001 && seg < 2 && (fix.speedKn ?? 0) > 0.3) {
        void import('../store/navigationStore').then(({ useNavigationStore }) => {
          if (useNavigationStore.getState().anchorAlarm?.active) return;
          void useNavigationStore.getState().addSessionDistanceNm(seg);
        });
      }
    }

    lastAcceptedFix = fix;
    smoothState = smoothEnabled ? smoothGpsPosition(smoothState, fix) : null;
    displayFix = smoothEnabled && smoothState ? buildDisplayFix(fix, smoothState, true) : fix;

    if (isFixQualityOk(fix)) {
      lastGoodFix = fix;
    }
  } else if (lastAcceptedFix) {
    displayFix =
      smoothEnabled && smoothState
        ? buildDisplayFix(lastAcceptedFix, smoothState, true)
        : lastAcceptedFix;
    lastGoodFix = isFixQualityOk(lastAcceptedFix) ? lastAcceptedFix : lastGoodFix;
  }

  return {
    fix,
    displayFix: displayFix ?? lastGoodFix,
    lastGoodFix: lastGoodFix ?? (isFixQualityOk(fix) ? fix : null),
    fixAcceptance: acceptance.accepted ? null : acceptance.reason,
  };
}

function enrichAndStore(raw: Omit<LocationFix, 'cogDeg'>, smoothEnabled: boolean): ProcessedFix | null {
  return processRawFix(raw, smoothEnabled);
}

function applyProcessedToStore(processed: ProcessedFix | null, set: (partial: Partial<LocationStore>) => void): void {
  if (!processed) return;
  set({
    fix: processed.fix,
    displayFix: processed.displayFix,
    lastGoodFix: processed.lastGoodFix ?? processed.displayFix,
    fixAcceptance: processed.fixAcceptance,
    error: null,
  });
}

export function applyBackgroundLocationFix(loc: Location.LocationObject): LocationFix | null {
  const { useSettingsStore } = require('../store/settingsStore') as typeof import('../store/settingsStore');
  const smoothEnabled = useSettingsStore.getState().gpsSmoothPosition;
  const processed = enrichAndStore(mapLocation(loc), smoothEnabled);
  applyProcessedToStore(processed, (partial) => useLocationStore.setState(partial));
  return processed?.fix ?? null;
}

function snapshotToStorePartial(snapshot: LocationPermissionSnapshot): Pick<
  LocationStore,
  'permission' | 'foregroundCanAskAgain' | 'backgroundCanAskAgain' | 'reducedAccuracy'
> {
  return {
    permission: mapSnapshotToPermissionState(snapshot),
    foregroundCanAskAgain: snapshot.foregroundCanAskAgain,
    backgroundCanAskAgain: snapshot.backgroundCanAskAgain,
    reducedAccuracy: snapshot.reducedAccuracy,
  };
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  permission: 'undetermined',
  foregroundCanAskAgain: true,
  backgroundCanAskAgain: true,
  reducedAccuracy: false,
  fix: null,
  displayFix: null,
  lastGoodFix: null,
  fixAcceptance: null,
  error: null,
  watching: false,
  watchProfile: null,

  refreshPermission: async () => {
    set(snapshotToStorePartial(await readLocationPermissionSnapshot()));
  },

  applyPermissionSnapshot: (snapshot) => {
    set(snapshotToStorePartial(snapshot));
  },

  startWatching: async (options) => {
    const profile = options?.profile ?? 'navigation';
    if (get().watching && activeWatchProfile === profile) return true;
    const requestIfUndetermined = options?.requestIfUndetermined !== false;
    try {
      let fg = await Location.getForegroundPermissionsAsync();
      if (fg.status === Location.PermissionStatus.UNDETERMINED && requestIfUndetermined) {
        fg = await Location.requestForegroundPermissionsAsync();
      }
      set(snapshotToStorePartial(await readLocationPermissionSnapshot()));
      if (fg.status !== Location.PermissionStatus.GRANTED) {
        set({
          error: fg.status === Location.PermissionStatus.DENIED ? 'permission_denied' : null,
          watching: false,
          watchProfile: null,
        });
        return false;
      }
      await attachWatchSubscription(profile, set, get);
      return true;
    } catch (error) {
      console.warn('[locationService] startWatching failed', error);
      subscription?.remove();
      subscription = null;
      activeWatchProfile = null;
      set({ watching: false, watchProfile: null, error: 'watch_failed' });
      return false;
    }
  },

  setWatchProfile: async (profile) => {
    if (get().permission === 'denied') return false;
    if (get().watching && activeWatchProfile === profile) return true;
    if (!get().watching) {
      return get().startWatching({ profile, requestIfUndetermined: false });
    }
    try {
      await attachWatchSubscription(profile, set, get);
      return true;
    } catch (error) {
      console.warn('[locationService] setWatchProfile failed', error);
      return false;
    }
  },

  stopWatching: (options) => {
    subscription?.remove();
    subscription = null;
    activeWatchProfile = null;
    if (options?.clearFixHistory !== false) {
      lastAcceptedFix = null;
      smoothState = null;
    }
    set({ watching: false, watchProfile: null, fixAcceptance: null });
  },
}));

/** Position for map, course vector, and coordinates — smoothed when available. */
export function resolveMapDisplayFix(
  fix: LocationFix | null,
  displayFix: LocationFix | null,
  lastGoodFix: LocationFix | null,
  stale: boolean,
): LocationFix | null {
  if (!stale && displayFix) return displayFix;
  if (!stale && fix) return fix;
  return lastGoodFix;
}

/** Hook — map/instrument position with optional accuracy smoothing. */
export function useMapDisplayFix(): LocationFix | null {
  const fix = useLocationStore((s) => s.fix);
  const displayFix = useLocationStore((s) => s.displayFix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  return resolveMapDisplayFix(fix, displayFix, lastGoodFix, isFixStale(fix));
}

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
