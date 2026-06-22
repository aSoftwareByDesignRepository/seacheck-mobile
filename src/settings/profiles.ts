import type { LayoutPreset } from '../settings/defaults';

export type ActivityProfileId = 'cruise-passage' | 'sailing-race' | 'hiking' | 'cycling' | 'anchor-camp';

export type ActivityProfile = {
  id: ActivityProfileId;
  labelKey: string;
  defaultLayout: LayoutPreset;
  sogUnit: 'kn' | 'kmh';
  distanceUnit: 'nm' | 'km';
};

export const ACTIVITY_PROFILES: ActivityProfile[] = [
  { id: 'cruise-passage', labelKey: 'profiles.cruisePassage', defaultLayout: 'map-forward', sogUnit: 'kn', distanceUnit: 'nm' },
  { id: 'sailing-race', labelKey: 'profiles.sailingRace', defaultLayout: 'instruments-forward', sogUnit: 'kn', distanceUnit: 'nm' },
  { id: 'hiking', labelKey: 'profiles.hiking', defaultLayout: 'map-forward', sogUnit: 'kmh', distanceUnit: 'km' },
  { id: 'cycling', labelKey: 'profiles.cycling', defaultLayout: 'split', sogUnit: 'kmh', distanceUnit: 'km' },
  { id: 'anchor-camp', labelKey: 'profiles.anchorCamp', defaultLayout: 'instruments-forward', sogUnit: 'kn', distanceUnit: 'nm' },
];

export const LAYOUT_PRESETS: LayoutPreset[] = ['map-forward', 'instruments-forward', 'split', 'minimal'];

export function getActivityProfile(id: string): ActivityProfile | undefined {
  return ACTIVITY_PROFILES.find((p) => p.id === id);
}
