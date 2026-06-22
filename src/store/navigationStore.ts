import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { WaypointRow } from '../lib/db/database';

const STORAGE_KEY = 'seacheck.navigation.v1';

export type NavigationTarget = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: 'waypoint' | 'mob';
};

export type AnchorAlarmState = {
  active: boolean;
  latitude: number;
  longitude: number;
  radiusNm: number;
  triggered: boolean;
};

export type AlarmLimits = {
  xteNm: number;
  arrivalNm: number;
};

export type StartLine = {
  pinAWaypointId: string;
  pinBWaypointId: string;
};

type PersistPayload = {
  goToTarget: NavigationTarget | null;
  mobTarget: NavigationTarget | null;
  anchorAlarm: AnchorAlarmState | null;
  activeLegIndex: number;
  sessionDistanceNm: number;
  alarmLimits: AlarmLimits;
  screenLocked: boolean;
  legTimerStartedAtMs: number | null;
  startLine: StartLine | null;
  raceStartAtMs: number | null;
};

type NavigationState = PersistPayload & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setGoTo: (target: NavigationTarget | null) => Promise<void>;
  dropMob: (lat: number, lon: number) => Promise<NavigationTarget>;
  clearMob: () => Promise<void>;
  setAnchorAlarm: (lat: number, lon: number, radiusNm: number) => Promise<void>;
  clearAnchorAlarm: () => Promise<void>;
  setAnchorTriggered: (triggered: boolean) => Promise<void>;
  setActiveLegIndex: (index: number) => Promise<void>;
  addSessionDistanceNm: (nm: number) => Promise<void>;
  resetSessionDistance: () => Promise<void>;
  setScreenLocked: (locked: boolean) => Promise<void>;
  patchAlarmLimits: (patch: Partial<AlarmLimits>) => Promise<void>;
  resetLegTimer: () => Promise<void>;
  setStartLine: (pinAWaypointId: string, pinBWaypointId: string) => Promise<void>;
  clearStartLine: () => Promise<void>;
  setRaceStartAt: (ms: number | null) => Promise<void>;
};

const DEFAULT_LIMITS: AlarmLimits = { xteNm: 0.25, arrivalNm: 0.1 };

const defaultAnchor: AnchorAlarmState = {
  active: false,
  latitude: 0,
  longitude: 0,
  radiusNm: 0.05,
  triggered: false,
};

async function persist(state: NavigationState) {
  const payload: PersistPayload = {
    goToTarget: state.goToTarget,
    mobTarget: state.mobTarget,
    anchorAlarm: state.anchorAlarm,
    activeLegIndex: state.activeLegIndex,
    sessionDistanceNm: state.sessionDistanceNm,
    alarmLimits: state.alarmLimits,
    screenLocked: state.screenLocked,
    legTimerStartedAtMs: state.legTimerStartedAtMs,
    startLine: state.startLine,
    raceStartAtMs: state.raceStartAtMs,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  hydrated: false,
  goToTarget: null,
  mobTarget: null,
  anchorAlarm: null,
  activeLegIndex: 0,
  sessionDistanceNm: 0,
  alarmLimits: DEFAULT_LIMITS,
  screenLocked: false,
  legTimerStartedAtMs: null,
  startLine: null,
  raceStartAtMs: null,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload>;
        set({
          goToTarget: parsed.goToTarget ?? null,
          mobTarget: parsed.mobTarget ?? null,
          anchorAlarm: parsed.anchorAlarm ?? null,
          activeLegIndex: parsed.activeLegIndex ?? 0,
          sessionDistanceNm: parsed.sessionDistanceNm ?? 0,
          alarmLimits: { ...DEFAULT_LIMITS, ...(parsed.alarmLimits ?? {}) },
          screenLocked: Boolean(parsed.screenLocked),
          legTimerStartedAtMs: parsed.legTimerStartedAtMs ?? null,
          startLine: parsed.startLine ?? null,
          raceStartAtMs: parsed.raceStartAtMs ?? null,
        });
      } catch {
        /* defaults */
      }
    }
    set({ hydrated: true });
  },

  setGoTo: async (target) => {
    set({ goToTarget: target });
    await persist(get());
  },

  dropMob: async (lat, lon) => {
    const target: NavigationTarget = {
      id: `mob_${Date.now()}`,
      name: 'MOB',
      latitude: lat,
      longitude: lon,
      kind: 'mob',
    };
    set({ mobTarget: target, goToTarget: target });
    await persist(get());
    return target;
  },

  clearMob: async () => {
    const { goToTarget, mobTarget } = get();
    set({
      mobTarget: null,
      goToTarget: goToTarget?.kind === 'mob' ? null : goToTarget,
    });
    await persist(get());
  },

  setAnchorAlarm: async (lat, lon, radiusNm) => {
    set({
      anchorAlarm: {
        active: true,
        latitude: lat,
        longitude: lon,
        radiusNm: Math.max(0.01, radiusNm),
        triggered: false,
      },
    });
    await persist(get());
  },

  clearAnchorAlarm: async () => {
    set({ anchorAlarm: null });
    await persist(get());
  },

  setAnchorTriggered: async (triggered) => {
    const current = get().anchorAlarm;
    if (!current) return;
    set({ anchorAlarm: { ...current, triggered } });
    await persist(get());
  },

  setActiveLegIndex: async (index) => {
    set({ activeLegIndex: Math.max(0, index) });
    await persist(get());
  },

  addSessionDistanceNm: async (nm) => {
    if (nm <= 0 || !Number.isFinite(nm)) return;
    set({ sessionDistanceNm: get().sessionDistanceNm + nm });
    await persist(get());
  },

  resetSessionDistance: async () => {
    set({ sessionDistanceNm: 0 });
    await persist(get());
  },

  setScreenLocked: async (locked) => {
    set({ screenLocked: locked });
    await persist(get());
  },

  patchAlarmLimits: async (patch) => {
    set({ alarmLimits: { ...get().alarmLimits, ...patch } });
    await persist(get());
  },

  resetLegTimer: async () => {
    set({ legTimerStartedAtMs: Date.now() });
    await persist(get());
  },

  setStartLine: async (pinAWaypointId, pinBWaypointId) => {
    if (pinAWaypointId === pinBWaypointId) return;
    set({ startLine: { pinAWaypointId, pinBWaypointId } });
    await persist(get());
  },

  clearStartLine: async () => {
    set({ startLine: null });
    await persist(get());
  },

  setRaceStartAt: async (ms) => {
    set({ raceStartAtMs: ms });
    await persist(get());
  },
}));

export function waypointToTarget(wp: WaypointRow): NavigationTarget {
  return {
    id: wp.id,
    name: wp.name,
    latitude: wp.latitude,
    longitude: wp.longitude,
    kind: 'waypoint',
  };
}
