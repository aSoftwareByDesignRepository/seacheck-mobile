import { ACTIVITY_PROFILES, buildActivityProfileSettingsPatch, normalizeActivityProfileId } from '../src/settings/profiles';

describe('activity profile settings', () => {
  const cruise = ACTIVITY_PROFILES.find((p) => p.id === 'cruise-passage')!;

  it('normalizes legacy sailing-race to cruise-passage', () => {
    expect(normalizeActivityProfileId('sailing-race')).toBe('cruise-passage');
    expect(normalizeActivityProfileId(undefined)).toBe('cruise-passage');
  });

  it('builds settings patch from profile', () => {
    expect(buildActivityProfileSettingsPatch(cruise)).toEqual({
      activityProfileId: 'cruise-passage',
      sogUnit: 'kn',
      distanceUnit: 'nm',
    });
  });
});
