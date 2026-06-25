import { normalizeActivityProfileId } from '../src/settings/profiles';

describe('activity profiles', () => {
  it('normalizes legacy land and camp profiles to cruise-passage', () => {
    expect(normalizeActivityProfileId('hiking')).toBe('cruise-passage');
    expect(normalizeActivityProfileId('cycling')).toBe('cruise-passage');
    expect(normalizeActivityProfileId('anchor-camp')).toBe('cruise-passage');
    expect(normalizeActivityProfileId(undefined)).toBe('cruise-passage');
  });

  it('keeps maritime profile ids', () => {
    expect(normalizeActivityProfileId('sailing-race')).toBe('sailing-race');
  });
});
