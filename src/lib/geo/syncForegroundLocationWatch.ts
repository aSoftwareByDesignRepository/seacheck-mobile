import { AppState, type AppStateStatus } from 'react-native';

import { isBackgroundLocationRunning } from '../../services/backgroundLocationService';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import {
  currentForegroundGpsProfile,
  needsForegroundGpsWhileBackgrounded,
  readForegroundGpsDemand,
  resolveForegroundGpsProfile,
} from './foregroundGpsDemand';
import type { ForegroundGpsProfile } from './gpsLocationOptions';

export type SyncForegroundLocationOptions = {
  /** When true, may show the OS permission dialog if location is still undetermined. */
  requestIfUndetermined?: boolean;
};

/** Unified background GPS is eligible — fixes may come from the background task instead of a foreground watch. */
export function needsUnifiedBackgroundGps(): boolean {
  const demand = readForegroundGpsDemand();
  if (demand.locationPermission !== 'background') return false;

  const nav = useNavigationStore.getState();
  if (nav.anchorAlarm?.active) return true;
  if (nav.mobTarget != null || nav.goToTarget?.kind === 'mob') return true;
  if (demand.goToTargetActive) return true;
  return demand.recordingTrackId != null && demand.backgroundTrackRecording;
}

function normalizeAppState(appState: AppStateStatus | (() => AppStateStatus) = AppState.currentState): AppStateStatus {
  const raw = typeof appState === 'function' ? appState() : appState;
  if (raw === 'active' || raw === 'background' || raw === 'inactive' || raw === 'extension') {
    return raw;
  }
  // Jest mocks currentState as a function — default to active so safety paths fail open.
  return 'active';
}

async function shouldPauseWhenBackgroundEligible(): Promise<boolean> {
  if (!needsUnifiedBackgroundGps()) {
    return true;
  }
  try {
    return await isBackgroundLocationRunning();
  } catch {
    return false;
  }
}

/**
 * Pause the foreground watch only when:
 * - idle profile would suffice (not map / MOB / passage nav / foreground track),
 * - background GPS is eligible, and
 * - the native background task is actually running.
 *
 * Fail-open: if background status is unknown, keep the foreground watch alive.
 */
export async function shouldPauseForegroundWatch(
  appState: AppStateStatus | (() => AppStateStatus) = AppState.currentState,
): Promise<boolean> {
  const state = normalizeAppState(appState);
  if (state !== 'active') {
    if (needsForegroundGpsWhileBackgrounded()) {
      return false;
    }
    return shouldPauseWhenBackgroundEligible();
  }
  if (currentForegroundGpsProfile() === 'navigation') {
    return false;
  }
  if (!needsUnifiedBackgroundGps()) {
    return false;
  }
  return shouldPauseWhenBackgroundEligible();
}

/**
 * Anchor watch needs navigation accuracy unless unified background GPS is already running.
 * Other idle cases stay on the low-duty profile so we can pause when background GPS takes over.
 */
async function effectiveForegroundGpsProfile(): Promise<ForegroundGpsProfile> {
  const demand = readForegroundGpsDemand();
  const appState = normalizeAppState();

  if (
    appState !== 'active' &&
    demand.locationPermission === 'foreground' &&
    needsForegroundGpsWhileBackgrounded()
  ) {
    return 'navigation';
  }

  const profile = resolveForegroundGpsProfile(demand);
  const anchorAlarmActive = Boolean(useNavigationStore.getState().anchorAlarm?.active);
  if (profile !== 'idle' || !anchorAlarmActive) return profile;

  if (demand.locationPermission === 'background' && needsUnifiedBackgroundGps()) {
    try {
      if (await isBackgroundLocationRunning()) return 'idle';
    } catch {
      /* fail open — prefer navigation accuracy below */
    }
  }
  return 'navigation';
}

let reconcileChain: Promise<boolean> = Promise.resolve(true);

async function reconcileForegroundLocationWatch(
  options: SyncForegroundLocationOptions,
): Promise<boolean> {
  const store = useLocationStore.getState();
  if (store.permission === 'denied') {
    store.stopWatching({ clearFixHistory: true });
    return false;
  }

  if (await shouldPauseForegroundWatch()) {
    store.stopWatching({ clearFixHistory: false });
    return true;
  }

  const profile: ForegroundGpsProfile = await effectiveForegroundGpsProfile();
  const requestIfUndetermined =
    options.requestIfUndetermined ?? store.permission === 'undetermined';

  if (store.watching && store.watchProfile === profile) {
    return true;
  }

  if (!store.watching) {
    return store.startWatching({ profile, requestIfUndetermined });
  }

  return store.setWatchProfile(profile);
}

/**
 * Single entry point for adaptive foreground GPS — serialized so rapid tab/state
 * changes cannot interleave watch teardown and startup.
 */
export function syncForegroundLocationWatch(
  options: SyncForegroundLocationOptions = {},
): Promise<boolean> {
  const next = reconcileChain.then(() => reconcileForegroundLocationWatch(options));
  reconcileChain = next.then(
    () => true,
    () => true,
  );
  return next;
}

/** Test-only — reset serialized reconcile chain between cases. */
export function resetForegroundLocationWatchChainForTests(): void {
  reconcileChain = Promise.resolve(true);
}
