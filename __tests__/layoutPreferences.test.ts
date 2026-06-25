import { layoutContextKey, nextLayoutPreset, resolveLayoutPreset } from '../src/lib/settings/layoutPreferences';

describe('layoutPreferences', () => {
  it('builds stable context keys', () => {
    expect(layoutContextKey({ profileId: 'cruise-passage', bucket: 'compact', isLandscape: false })).toBe(
      'cruise-passage:compact:portrait',
    );
    expect(layoutContextKey({ profileId: 'sailing-race', bucket: 'expanded', isLandscape: true })).toBe(
      'sailing-race:expanded:landscape',
    );
  });

  it('resolves profile default when no override', () => {
    expect(resolveLayoutPreset('sailing-race', 'compact', false, {})).toBe('instruments-forward');
    expect(resolveLayoutPreset('anchor-camp', 'compact', false, {})).toBe('map-forward');
  });

  it('uses override for matching context', () => {
    const key = layoutContextKey({ profileId: 'cruise-passage', bucket: 'compact', isLandscape: false });
    expect(resolveLayoutPreset('cruise-passage', 'compact', false, { [key]: 'minimal' })).toBe('minimal');
  });

  it('cycles through all layout presets', () => {
    expect(nextLayoutPreset('coordinates')).toBe('map-forward');
  });
});
