import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { resetAlarmRuntime } from '../lib/alarms/alarmRuntimeState';
import type { AnchorWatchStatus } from '../lib/anchor/types';
import type { WaypointRow } from '../lib/db/database';
import { isValidCoordinate } from '../lib/geo/fixQuality';
import { enqueuePersist } from '../lib/persist/asyncPersistQueue';
import { t } from '../i18n';
import { ensureMaritimeAlarmNotifications } from '../services/maritimeAlarmNotifications';

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
  mobDroppedAtMs: number | null;
  anchorAlarm: AnchorAlarmState | null;
  activeLegIndex: number;
  sessionDistanceNm: number;
  sessionStartedAtMs: number | null;
  alarmLimits: AlarmLimits;
  screenLocked: boolean;
  legTimerStartedAtMs: number | null;
  startLine: StartLine | null;
  raceStartAtMs: number | null;
};

type NavigationState = PersistPayload & {
  hydrated: boolean;
  /** Ephemeral UI — anchor watch setup prompt after setting alarm with limited background. */
  anchorWatchPrompt: AnchorWatchStatus | null;
  setAnchorWatchPrompt: (status: AnchorWatchStatus | null) => void;
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
  ensureSessionStarted: () => Promise<void>;
  setScreenLocked: (locked: boolean) => Promise<void>;
  patchAlarmLimits: (patch: Partial<AlarmLimits>) => Promise<void>;
  resetLegTimer: () => Promise<void>;
  setStartLine: (pinAWaypointId: string, pinBWaypointId: string) => Promise<void>;
  clearStartLine: () => Promise<void>;
  setRaceStartAt: (ms: number | null) => Promise<void>;
};

const DEFAULT_LIMITS: AlarmLimits = { xteNm: 0.05, arrivalNm: 0.1 };

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
    mobDroppedAtMs: state.mobDroppedAtMs,
    anchorAlarm: state.anchorAlarm,
    activeLegIndex: state.activeLegIndex,
    sessionDistanceNm: state.sessionDistanceNm,
    sessionStartedAtMs: state.sessionStartedAtMs,
    alarmLimits: state.alarmLimits,
    screenLocked: state.screenLocked,
    legTimerStartedAtMs: state.legTimerStartedAtMs,
    startLine: state.startLine,
    raceStartAtMs: state.raceStartAtMs,
  };
  await enqueuePersist(STORAGE_KEY, () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)));
}

function sanitizeAnchorAlarm(raw: unknown): AnchorAlarmState | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<AnchorAlarmState>;
  if (!a.active) return null;
  if (!isValidCoordinate(a.latitude ?? NaN, a.longitude ?? NaN)) return null;
  return {
    active: true,
    latitude: a.latitude!,
    longitude: a.longitude!,
    radiusNm: Math.max(0.01, Number(a.radiusNm) || 0.05),
    triggered: Boolean(a.triggered),
  };
}

function sanitizeNavigationTarget(raw: unknown): NavigationTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const target = raw as Partial<NavigationTarget>;
  if (!target.id || !target.name || !isValidCoordinate(target.latitude ?? NaN, target.longitude ?? NaN)) return null;
  if (target.kind !== 'waypoint' && target.kind !== 'mob') return null;
  return {
    id: target.id,
    name: target.name,
    latitude: target.latitude!,
    longitude: target.longitude!,
    kind: target.kind,
  };
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  hydrated: false,
  goToTarget: null,
  mobTarget: null,
  mobDroppedAtMs: null,
  anchorAlarm: null,
  activeLegIndex: 0,
  sessionDistanceNm: 0,
  sessionStartedAtMs: null,
  alarmLimits: DEFAULT_LIMITS,
  screenLocked: false,
  legTimerStartedAtMs: null,
  startLine: null,
  raceStartAtMs: null,
  anchorWatchPrompt: null,

  setAnchorWatchPrompt: (status) => set({ anchorWatchPrompt: status }),

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload>;
        set({
          goToTarget: sanitizeNavigationTarget(parsed.goToTarget),
          mobTarget: sanitizeNavigationTarget(parsed.mobTarget),
          mobDroppedAtMs: typeof parsed.mobDroppedAtMs === 'number' ? parsed.mobDroppedAtMs : null,
          anchorAlarm: sanitizeAnchorAlarm(parsed.anchorAlarm),
          activeLegIndex: Math.max(0, Number(parsed.activeLegIndex) || 0),
          sessionDistanceNm: Math.max(0, Number(parsed.sessionDistanceNm) || 0),
          sessionStartedAtMs: typeof parsed.sessionStartedAtMs === 'number' ? parsed.sessionStartedAtMs : null,
          alarmLimits: {
            ...DEFAULT_LIMITS,
            xteNm: Math.max(0.001, Number(parsed.alarmLimits?.xteNm) || DEFAULT_LIMITS.xteNm),
            arrivalNm: Math.max(0.001, Number(parsed.alarmLimits?.arrivalNm) || DEFAULT_LIMITS.arrivalNm),
          },
          screenLocked: Boolean(parsed.screenLocked),
          legTimerStartedAtMs: typeof parsed.legTimerStartedAtMs === 'number' ? parsed.legTimerStartedAtMs : null,
          startLine: parsed.startLine ?? null,
          raceStartAtMs: typeof parsed.raceStartAtMs === 'number' ? parsed.raceStartAtMs : null,
        });
      } catch (error) {
        console.warn('[navigationStore] hydrate failed', error);
      }
    }
    set({ hydrated: true });
  },

  setGoTo: async (target) => {
    set({ goToTarget: target });
    await persist(get());
  },

  dropMob: async (lat, lon) => {
    if (!isValidCoordinate(lat, lon)) {
      throw new Error('invalid_mob_coordinates');
    }
    const now = Date.now();
    const target: NavigationTarget = {
      id: `mob_${now}`,
      name: t('map.mobShort'),
      latitude: lat,
      longitude: lon,
      kind: 'mob',
    };
    set({ mobTarget: target, goToTarget: target, mobDroppedAtMs: now });
    await persist(get());
    return target;
  },

  clearMob: async () => {
    const { goToTarget, mobTarget } = get();
    set({
      mobTarget: null,
      mobDroppedAtMs: null,
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
    await resetAlarmRuntime();
    try {
      void ensureMaritimeAlarmNotifications();
      const { syncBackgroundLocationMonitoring } = await import('../services/backgroundLocationService');
      const sync = await syncBackgroundLocationMonitoring();
      if (!sync.ok) {
        console.warn('[navigationStore] anchor alarm background sync failed', sync.reason);
      }
    } catch (error) {
      console.warn('[navigationStore] anchor alarm background sync failed', error);
    }
  },

  clearAnchorAlarm: async () => {
    set({ anchorAlarm: null });
    await persist(get());
    await resetAlarmRuntime();
    const { syncBackgroundLocationMonitoring } = await import('../services/backgroundLocationService');
    await syncBackgroundLocationMonitoring();
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
    set({ sessionDistanceNm: 0, sessionStartedAtMs: Date.now() });
    await persist(get());
  },

  ensureSessionStarted: async () => {
    if (get().sessionStartedAtMs != null) return;
    set({ sessionStartedAtMs: Date.now() });
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
