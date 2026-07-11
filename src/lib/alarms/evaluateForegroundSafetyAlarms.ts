import { AppState, type AppStateStatus } from 'react-native';
import type * as Location from 'expo-location';

import { FIX_STALE_MS } from '../geo/fixAge';
import { shouldForegroundPipelineEvaluateAlarms } from './foregroundAlarmPipeline';
import { processFixFromLocation, type AlarmLiveState } from './alarmCoordinator';
import { isFixStale, useLocationStore, type LocationFix } from '../../services/locationService';

export type EvaluateForegroundSafetyAlarmsOptions = {
  appState?: AppStateStatus;
  liveState: AlarmLiveState;
  /** Leg-advance prompts are UI-only — disable on heartbeat ticks. */
  allowLegAdvancePrompt?: boolean;
  fix?: LocationFix | null;
};

function fixToLocationObject(fix: LocationFix): Location.LocationObject {
  return {
    coords: {
      latitude: fix.latitude,
      longitude: fix.longitude,
      speed: fix.speedMs,
      heading: fix.heading,
      accuracy: fix.accuracyM,
      altitude: fix.altitudeM,
    },
    timestamp: fix.timestamp,
  } as Location.LocationObject;
}

/** Anchor GPS-lost path when no fix is in the store yet (heartbeat / cold start). */
function syntheticStaleLocationForAnchorGpsLost(): Location.LocationObject {
  return {
    coords: {
      latitude: 0,
      longitude: 0,
      speed: null,
      heading: null,
      accuracy: null,
      altitude: null,
    },
    timestamp: Date.now() - FIX_STALE_MS - 1_000,
  } as Location.LocationObject;
}

/**
 * Shared entry for fix-driven and heartbeat-driven foreground alarm evaluation.
 * Returns null when the foreground pipeline should not run or there is nothing to evaluate.
 */
export async function evaluateForegroundSafetyAlarms(
  options: EvaluateForegroundSafetyAlarmsOptions,
): Promise<Awaited<ReturnType<typeof processFixFromLocation>> | null> {
  if (!(await shouldForegroundPipelineEvaluateAlarms())) {
    return null;
  }

  const fix = options.fix ?? useLocationStore.getState().fix;
  const anchorAlarm = options.liveState.anchorAlarm;

  if (!fix) {
    if (!anchorAlarm?.active) return null;
    const appState = options.appState ?? AppState.currentState;
    const allowLegAdvancePrompt = options.allowLegAdvancePrompt ?? appState === 'active';
    return processFixFromLocation(syntheticStaleLocationForAnchorGpsLost(), {
      inBackground: appState !== 'active',
      allowLegAdvancePrompt,
      liveState: options.liveState,
    });
  }

  if (isFixStale(fix) && !anchorAlarm?.active) {
    return null;
  }

  const appState = options.appState ?? AppState.currentState;
  const allowLegAdvancePrompt = options.allowLegAdvancePrompt ?? appState === 'active';

  return processFixFromLocation(fixToLocationObject(fix), {
    inBackground: appState !== 'active',
    allowLegAdvancePrompt,
    liveState: options.liveState,
  });
}
