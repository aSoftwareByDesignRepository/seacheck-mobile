import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  CRUISE_PASSAGE_DEFAULTS,
  type BearingReference,
  type CoordFormat,
  type DistanceUnit,
  type LayoutPreset,
  type SogUnit,
} from '../settings/defaults';

const STORAGE_KEY = 'seacheck.settings.v1';

export type VesselProfile = {
  name: string;
  callSign: string;
  mmsi: string;
  homePort: string;
};

type PersistPayload = {
  onboardingCompleted: boolean;
  batteryGuidanceAcknowledged: boolean;
  activityProfileId: string;
  layoutPreset: LayoutPreset;
  sogUnit: SogUnit;
  distanceUnit: DistanceUnit;
  bearingReference: BearingReference;
  coordFormat: CoordFormat;
  mapCourseUp: boolean;
  followMode: boolean;
  keepAwakeUnderway: boolean;
  backgroundTrackRecording: boolean;
  alarmSoundEnabled: boolean;
  alarmHapticEnabled: boolean;
  legAdvanceAuto: boolean;
  vessel: VesselProfile;
  raceWindDirectionTrue: number | null;
  raceTackingAngleDeg: number;
  raceTargetSogKn: number | null;
  raceShowLaylines: boolean;
};

type SettingsState = PersistPayload & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  acknowledgeBatteryGuidance: () => Promise<void>;
  updateVessel: (patch: Partial<VesselProfile>) => Promise<void>;
  patchSettings: (patch: Partial<PersistPayload>) => Promise<void>;
};

async function persist(state: SettingsState) {
  const payload: PersistPayload = {
    onboardingCompleted: state.onboardingCompleted,
    batteryGuidanceAcknowledged: state.batteryGuidanceAcknowledged,
    activityProfileId: state.activityProfileId,
    layoutPreset: state.layoutPreset,
    sogUnit: state.sogUnit,
    distanceUnit: state.distanceUnit,
    bearingReference: state.bearingReference,
    coordFormat: state.coordFormat,
    mapCourseUp: state.mapCourseUp,
    followMode: state.followMode,
    keepAwakeUnderway: state.keepAwakeUnderway,
    backgroundTrackRecording: state.backgroundTrackRecording,
    alarmSoundEnabled: state.alarmSoundEnabled,
    alarmHapticEnabled: state.alarmHapticEnabled,
    legAdvanceAuto: state.legAdvanceAuto,
    vessel: state.vessel,
    raceWindDirectionTrue: state.raceWindDirectionTrue,
    raceTackingAngleDeg: state.raceTackingAngleDeg,
    raceTargetSogKn: state.raceTargetSogKn,
    raceShowLaylines: state.raceShowLaylines,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

const emptyVessel: VesselProfile = { name: '', callSign: '', mmsi: '', homePort: '' };

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  onboardingCompleted: false,
  batteryGuidanceAcknowledged: false,
  backgroundTrackRecording: false,
  alarmSoundEnabled: true,
  alarmHapticEnabled: true,
  legAdvanceAuto: false,
  layoutPreset: 'map-forward',
  ...CRUISE_PASSAGE_DEFAULTS,
  vessel: emptyVessel,
  raceWindDirectionTrue: null,
  raceTackingAngleDeg: 45,
  raceTargetSogKn: null,
  raceShowLaylines: true,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload>;
        set({
          onboardingCompleted: Boolean(parsed.onboardingCompleted),
          batteryGuidanceAcknowledged: Boolean(parsed.batteryGuidanceAcknowledged),
          activityProfileId: parsed.activityProfileId ?? CRUISE_PASSAGE_DEFAULTS.activityProfileId,
          layoutPreset: parsed.layoutPreset ?? 'map-forward',
          sogUnit: parsed.sogUnit ?? CRUISE_PASSAGE_DEFAULTS.sogUnit,
          distanceUnit: parsed.distanceUnit ?? CRUISE_PASSAGE_DEFAULTS.distanceUnit,
          bearingReference: parsed.bearingReference ?? CRUISE_PASSAGE_DEFAULTS.bearingReference,
          coordFormat: parsed.coordFormat ?? CRUISE_PASSAGE_DEFAULTS.coordFormat,
          mapCourseUp: parsed.mapCourseUp ?? CRUISE_PASSAGE_DEFAULTS.mapCourseUp,
          followMode: parsed.followMode ?? CRUISE_PASSAGE_DEFAULTS.followMode,
          keepAwakeUnderway: parsed.keepAwakeUnderway ?? CRUISE_PASSAGE_DEFAULTS.keepAwakeUnderway,
          backgroundTrackRecording: Boolean(parsed.backgroundTrackRecording),
          alarmSoundEnabled: parsed.alarmSoundEnabled ?? true,
          alarmHapticEnabled: parsed.alarmHapticEnabled ?? true,
          legAdvanceAuto: Boolean(parsed.legAdvanceAuto),
          vessel: { ...emptyVessel, ...(parsed.vessel ?? {}) },
          raceWindDirectionTrue: parsed.raceWindDirectionTrue ?? null,
          raceTackingAngleDeg: parsed.raceTackingAngleDeg ?? 45,
          raceTargetSogKn: parsed.raceTargetSogKn ?? null,
          raceShowLaylines: parsed.raceShowLaylines ?? true,
        });
      } catch {
        /* defaults */
      }
    }
    set({ hydrated: true });
  },

  completeOnboarding: async () => {
    set({ onboardingCompleted: true, ...CRUISE_PASSAGE_DEFAULTS, layoutPreset: 'map-forward', vessel: get().vessel });
    await persist(get());
  },

  acknowledgeBatteryGuidance: async () => {
    set({ batteryGuidanceAcknowledged: true });
    await persist(get());
  },

  updateVessel: async (patch) => {
    set({ vessel: { ...get().vessel, ...patch } });
    await persist(get());
  },

  patchSettings: async (patch) => {
    set(patch);
    await persist(get());
  },
}));
