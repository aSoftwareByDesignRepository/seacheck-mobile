import type { LayoutPreset } from '../settings/defaults';

export type ActivityProfileId = 'cruise-passage';

export type ActivityProfile = {
  id: ActivityProfileId;
  labelKey: string;
  defaultLayout: LayoutPreset;
  sogUnit: 'kn' | 'kmh';
  distanceUnit: 'nm' | 'km';
};

/** Maritime activity profiles shown in Settings. */
export const ACTIVITY_PROFILES: ActivityProfile[] = [
  { id: 'cruise-passage', labelKey: 'profiles.cruisePassage', defaultLayout: 'map-forward', sogUnit: 'kn', distanceUnit: 'nm' },
];

export const LAYOUT_PRESETS: LayoutPreset[] = [
  'map-forward',
  'instruments-forward',
  'instruments-only',
  'split',
  'minimal',
  'coordinates',
];

const DEFAULT_PROFILE_ID: ActivityProfileId = 'cruise-passage';

/** Maps legacy or removed profile ids to a maritime default. */
export function normalizeActivityProfileId(id: string | undefined): ActivityProfileId {
  if (id === 'cruise-passage') return 'cruise-passage';
  return DEFAULT_PROFILE_ID;
}

export function getActivityProfile(id: string): ActivityProfile | undefined {
  return ACTIVITY_PROFILES.find((p) => p.id === normalizeActivityProfileId(id));
}

export function buildActivityProfileSettingsPatch(nextProfile: ActivityProfile): {
  activityProfileId: ActivityProfileId;
  sogUnit: ActivityProfile['sogUnit'];
  distanceUnit: ActivityProfile['distanceUnit'];
} {
  return {
    activityProfileId: nextProfile.id,
    sogUnit: nextProfile.sogUnit,
    distanceUnit: nextProfile.distanceUnit,
  };
}
