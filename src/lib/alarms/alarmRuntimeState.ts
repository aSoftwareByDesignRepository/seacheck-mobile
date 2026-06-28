import AsyncStorage from '@react-native-async-storage/async-storage';

export const ALARM_RUNTIME_KEY = 'seacheck.alarms.runtime.v1';

export type AlarmRuntimeState = {
  anchorSogStreak: number;
  /** Consecutive fixes outside anchor radius before radius drag fires. */
  anchorRadiusStreak: number;
  lastCriticalPulseMs: number;
  arrivalFiredTargetId: string | null;
  xteFired: boolean;
  legAdvancePromptLegIdx: number | null;
  /** Leg index already auto-advanced — prevents repeated leg_advance on every GPS tick. */
  lastAutoAdvancedLegIdx: number | null;
  /** Clears XTE latch when the active leg changes. */
  xteLegIdx: number | null;
  /** Throttles anchor GPS-lost warnings (foreground + background). */
  lastAnchorGpsWarnMs: number;
};

export const DEFAULT_ALARM_RUNTIME: AlarmRuntimeState = {
  anchorSogStreak: 0,
  anchorRadiusStreak: 0,
  lastCriticalPulseMs: 0,
  arrivalFiredTargetId: null,
  xteFired: false,
  legAdvancePromptLegIdx: null,
  lastAutoAdvancedLegIdx: null,
  xteLegIdx: null,
  lastAnchorGpsWarnMs: 0,
};

export async function loadAlarmRuntime(): Promise<AlarmRuntimeState> {
  const raw = await AsyncStorage.getItem(ALARM_RUNTIME_KEY);
  if (!raw) return { ...DEFAULT_ALARM_RUNTIME };
  try {
    return { ...DEFAULT_ALARM_RUNTIME, ...(JSON.parse(raw) as Partial<AlarmRuntimeState>) };
  } catch {
    return { ...DEFAULT_ALARM_RUNTIME };
  }
}

export async function saveAlarmRuntime(state: AlarmRuntimeState): Promise<void> {
  try {
    await AsyncStorage.setItem(ALARM_RUNTIME_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[alarmRuntimeState] save failed', error);
  }
}

export async function resetAlarmRuntime(): Promise<void> {
  await AsyncStorage.removeItem(ALARM_RUNTIME_KEY);
}
