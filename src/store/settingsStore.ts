import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  CRUISE_PASSAGE_DEFAULTS,
  DEFAULT_SEAMARK_PLANNING,
  DEFAULT_CHART_BASE_STYLE,
  type BearingReference,
  type CoordFormat,
  type AnchorRadiusNm,
  type CourseVectorMinutes,
  type CourseVectorVisualScale,
  type DistanceUnit,
  type FollowZoomLevel,
  type ChartBaseStyle,
  type LayoutPreset,
  type PanelSide,
  type SeamarkPlanningConfig,
  type SogUnit,
} from '../settings/defaults';
import { layoutContextKey, normalizeLayoutPreset, type LayoutContext } from '../lib/settings/layoutPreferences';
import { normalizeChartBaseStyle } from '../lib/settings/chartBaseStyle';
import { enqueuePersist } from '../lib/persist/asyncPersistQueue';
import { buildActivityProfileSettingsPatch, getActivityProfile, normalizeActivityProfileId } from '../settings/profiles';
import { normalizeAnchorRadiusNm, normalizeCourseVectorMinutes, normalizeCourseVectorScale, normalizeFollowZoom } from '../lib/settings/mapSettings';
import { normalizeSeamarkPlanning } from '../lib/settings/seamarkSettings';

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
  downloadHintDismissed: boolean;
  activityProfileId: string;
  /** @deprecated Use layoutOverrides + resolveLayoutPreset — kept for migration only */
  layoutPreset: LayoutPreset;
  layoutOverrides: Record<string, LayoutPreset>;
  sogUnit: SogUnit;
  distanceUnit: DistanceUnit;
  bearingReference: BearingReference;
  coordFormat: CoordFormat;
  mapCourseUp: boolean;
  mapShowCourseVector: boolean;
  mapCourseVectorMinutes: CourseVectorMinutes;
  mapCourseVectorScale: CourseVectorVisualScale;
  mapFollowZoom: FollowZoomLevel;
  chartBaseStyle: ChartBaseStyle;
  mapShowPassageRouteLines: boolean;
  seamarkPlanning: SeamarkPlanningConfig;
  anchorRadiusNm: AnchorRadiusNm;
  followMode: boolean;
  keepAwakeUnderway: boolean;
  barometerEnabled: boolean;
  gpsSmoothPosition: boolean;
  backgroundTrackRecording: boolean;
  alarmSoundEnabled: boolean;
  alarmHapticEnabled: boolean;
  legAdvanceAuto: boolean;
  vessel: VesselProfile;
  downloadWifiOnly: boolean;
  gloveMode: boolean;
  panelSide: PanelSide;
};

type SettingsState = PersistPayload & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  acknowledgeBatteryGuidance: () => Promise<void>;
  dismissDownloadHint: () => Promise<void>;
  updateVessel: (patch: Partial<VesselProfile>) => Promise<void>;
  patchSettings: (patch: Partial<PersistPayload>) => Promise<void>;
  setLayoutOverride: (preset: LayoutPreset, ctx: LayoutContext) => Promise<void>;
  applyActivityProfile: (profileId: string) => Promise<void>;
};

async function persist(state: SettingsState) {
  const payload: PersistPayload = {
    onboardingCompleted: state.onboardingCompleted,
    batteryGuidanceAcknowledged: state.batteryGuidanceAcknowledged,
    downloadHintDismissed: state.downloadHintDismissed,
    activityProfileId: state.activityProfileId,
    layoutPreset: state.layoutPreset,
    layoutOverrides: state.layoutOverrides,
    sogUnit: state.sogUnit,
    distanceUnit: state.distanceUnit,
    bearingReference: state.bearingReference,
    coordFormat: state.coordFormat,
    mapCourseUp: state.mapCourseUp,
    mapShowCourseVector: state.mapShowCourseVector,
    mapCourseVectorMinutes: state.mapCourseVectorMinutes,
    mapCourseVectorScale: state.mapCourseVectorScale,
    mapFollowZoom: state.mapFollowZoom,
    chartBaseStyle: state.chartBaseStyle,
    mapShowPassageRouteLines: state.mapShowPassageRouteLines,
    seamarkPlanning: state.seamarkPlanning,
    anchorRadiusNm: state.anchorRadiusNm,
    followMode: state.followMode,
    keepAwakeUnderway: state.keepAwakeUnderway,
    barometerEnabled: state.barometerEnabled,
    gpsSmoothPosition: state.gpsSmoothPosition,
    backgroundTrackRecording: state.backgroundTrackRecording,
    alarmSoundEnabled: state.alarmSoundEnabled,
    alarmHapticEnabled: state.alarmHapticEnabled,
    legAdvanceAuto: state.legAdvanceAuto,
    vessel: state.vessel,
    downloadWifiOnly: state.downloadWifiOnly,
    gloveMode: state.gloveMode,
    panelSide: state.panelSide,
  };
  await enqueuePersist(STORAGE_KEY, () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)));
}

const emptyVessel: VesselProfile = { name: '', callSign: '', mmsi: '', homePort: '' };

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  onboardingCompleted: false,
  batteryGuidanceAcknowledged: false,
  downloadHintDismissed: false,
  backgroundTrackRecording: false,
  alarmSoundEnabled: true,
  alarmHapticEnabled: true,
  legAdvanceAuto: false,
  layoutPreset: 'map-forward',
  layoutOverrides: {},
  ...CRUISE_PASSAGE_DEFAULTS,
  chartBaseStyle: DEFAULT_CHART_BASE_STYLE,
  mapShowPassageRouteLines: true,
  seamarkPlanning: DEFAULT_SEAMARK_PLANNING,
  vessel: emptyVessel,
  downloadWifiOnly: true,
  gloveMode: false,
  panelSide: 'auto',

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<PersistPayload & { layoutOverrides?: Record<string, LayoutPreset> }>;
        const legacyPreset = normalizeLayoutPreset(parsed.layoutPreset);
        const layoutOverridesRaw = parsed.layoutOverrides ?? {};
        const layoutOverrides: Record<string, LayoutPreset> = {};
        for (const [key, preset] of Object.entries(layoutOverridesRaw)) {
          layoutOverrides[key] = normalizeLayoutPreset(preset, legacyPreset);
        }
        if (Object.keys(layoutOverrides).length === 0 && parsed.layoutPreset) {
          layoutOverrides[layoutContextKey({ profileId: parsed.activityProfileId ?? 'cruise-passage', bucket: 'compact', isLandscape: false })] =
            legacyPreset;
        }
        set({
          onboardingCompleted: Boolean(parsed.onboardingCompleted),
          batteryGuidanceAcknowledged: Boolean(parsed.batteryGuidanceAcknowledged),
          downloadHintDismissed: Boolean(parsed.downloadHintDismissed),
          activityProfileId: normalizeActivityProfileId(parsed.activityProfileId),
          layoutPreset: legacyPreset,
          layoutOverrides,
          sogUnit: parsed.sogUnit ?? CRUISE_PASSAGE_DEFAULTS.sogUnit,
          distanceUnit: parsed.distanceUnit ?? CRUISE_PASSAGE_DEFAULTS.distanceUnit,
          bearingReference: parsed.bearingReference ?? CRUISE_PASSAGE_DEFAULTS.bearingReference,
          coordFormat: parsed.coordFormat ?? CRUISE_PASSAGE_DEFAULTS.coordFormat,
          mapCourseUp: parsed.mapCourseUp ?? CRUISE_PASSAGE_DEFAULTS.mapCourseUp,
          mapShowCourseVector: parsed.mapShowCourseVector ?? CRUISE_PASSAGE_DEFAULTS.mapShowCourseVector,
          mapCourseVectorMinutes: normalizeCourseVectorMinutes(parsed.mapCourseVectorMinutes),
          mapCourseVectorScale: normalizeCourseVectorScale(parsed.mapCourseVectorScale),
          mapFollowZoom: normalizeFollowZoom(parsed.mapFollowZoom),
          chartBaseStyle: normalizeChartBaseStyle(parsed.chartBaseStyle),
          mapShowPassageRouteLines: parsed.mapShowPassageRouteLines ?? true,
          seamarkPlanning: normalizeSeamarkPlanning(parsed.seamarkPlanning),
          anchorRadiusNm: normalizeAnchorRadiusNm(parsed.anchorRadiusNm),
          followMode: parsed.followMode ?? CRUISE_PASSAGE_DEFAULTS.followMode,
          keepAwakeUnderway: parsed.keepAwakeUnderway ?? CRUISE_PASSAGE_DEFAULTS.keepAwakeUnderway,
          barometerEnabled: parsed.barometerEnabled ?? CRUISE_PASSAGE_DEFAULTS.barometerEnabled,
          gpsSmoothPosition: parsed.gpsSmoothPosition ?? CRUISE_PASSAGE_DEFAULTS.gpsSmoothPosition,
          backgroundTrackRecording: Boolean(parsed.backgroundTrackRecording),
          alarmSoundEnabled: parsed.alarmSoundEnabled ?? true,
          alarmHapticEnabled: parsed.alarmHapticEnabled ?? true,
          legAdvanceAuto: Boolean(parsed.legAdvanceAuto),
          vessel: { ...emptyVessel, ...(parsed.vessel ?? {}) },
          downloadWifiOnly: parsed.downloadWifiOnly ?? true,
          gloveMode: Boolean(parsed.gloveMode),
          panelSide: parsed.panelSide === 'port' || parsed.panelSide === 'starboard' ? parsed.panelSide : 'auto',
        });
      } catch {
        /* defaults */
      }
    }
    set({ hydrated: true });
  },

  completeOnboarding: async () => {
    set({ onboardingCompleted: true });
    await persist(get());
  },

  acknowledgeBatteryGuidance: async () => {
    set({ batteryGuidanceAcknowledged: true });
    await persist(get());
  },

  dismissDownloadHint: async () => {
    set({ downloadHintDismissed: true });
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

  setLayoutOverride: async (preset, ctx) => {
    const key = layoutContextKey(ctx);
    set({
      layoutPreset: preset,
      layoutOverrides: { ...get().layoutOverrides, [key]: preset },
    });
    await persist(get());
  },

  applyActivityProfile: async (profileId) => {
    const profile = getActivityProfile(profileId);
    if (!profile) return;
    set(buildActivityProfileSettingsPatch(profile));
    await persist(get());
  },
}));
