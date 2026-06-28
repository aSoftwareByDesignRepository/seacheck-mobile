import { layoutContextKey, nextLayoutPreset, normalizeLayoutPreset, resolveLayoutPreset } from '../src/lib/settings/layoutPreferences';

describe('layoutPreferences', () => {
  it('builds stable context keys', () => {
    expect(layoutContextKey({ profileId: 'cruise-passage', bucket: 'compact', isLandscape: false })).toBe(
      'cruise-passage:compact:portrait',
    );
    expect(layoutContextKey({ profileId: 'cruise-passage', bucket: 'expanded', isLandscape: true })).toBe(
      'cruise-passage:expanded:landscape',
    );
  });

  it('resolves profile default when no override', () => {
    expect(resolveLayoutPreset('cruise-passage', 'compact', false, {})).toBe('map-forward');
    expect(resolveLayoutPreset('anchor-camp', 'compact', false, {})).toBe('map-forward');
  });

  it('uses override for matching context', () => {
    const key = layoutContextKey({ profileId: 'cruise-passage', bucket: 'compact', isLandscape: false });
    expect(resolveLayoutPreset('cruise-passage', 'compact', false, { [key]: 'minimal' })).toBe('minimal');
  });

  it('cycles through all layout presets', () => {
    expect(nextLayoutPreset('coordinates')).toBe('map-forward');
    expect(nextLayoutPreset('instruments-only')).toBe('split');
  });

  it('normalizes unknown stored presets', () => {
    expect(normalizeLayoutPreset('bogus')).toBe('map-forward');
    expect(normalizeLayoutPreset('instruments-only')).toBe('instruments-only');
  });
});
