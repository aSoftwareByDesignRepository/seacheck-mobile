import {
  normalizeBearingReference,
  normalizeCoordFormat,
  normalizeDistanceUnit,
  normalizeSogUnit,
} from '../src/lib/settings/normalizeSettingsEnums';

describe('normalizeSettingsEnums', () => {
  it('accepts known enum values and rejects garbage', () => {
    expect(normalizeSogUnit('kn')).toBe('kn');
    expect(normalizeSogUnit('nope')).toBe('kn');
    expect(normalizeSogUnit(1)).toBe('kn');
    expect(normalizeDistanceUnit('km')).toBe('km');
    expect(normalizeDistanceUnit('yards')).toBe('nm');
    expect(normalizeBearingReference('magnetic')).toBe('magnetic');
    expect(normalizeBearingReference('grid')).toBe('true');
    expect(normalizeCoordFormat('dms')).toBe('dms');
    expect(normalizeCoordFormat('utm')).toBe('ddm');
  });
});
