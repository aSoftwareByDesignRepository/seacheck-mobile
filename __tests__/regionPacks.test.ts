import { MAX_TILE_COUNT } from '../src/lib/map/bounds';
import { LEGACY_REGION_PACKS } from '../src/map/legacyRegionPacks';
import { REGION_PACKS } from '../src/map/regionPacks';
import { validateRegionPack } from '../src/map/regionPackValidation';

describe('region packs', () => {
  it('keeps every downloadable pack within the custom download tile budget', () => {
    for (const pack of REGION_PACKS) {
      const result = validateRegionPack(pack);
      expect(result.ok).toBe(true);
      expect(result.tileCount).toBeLessThanOrEqual(MAX_TILE_COUNT);
    }
  });

  it('documents legacy macro-packs that were too large for routine download', () => {
    for (const pack of LEGACY_REGION_PACKS) {
      expect(pack.legacy).toBe(true);
    }
    const oversized = LEGACY_REGION_PACKS.filter((p) => !validateRegionPack(p).ok);
    expect(oversized.length).toBeGreaterThanOrEqual(4);
    const balticWest = LEGACY_REGION_PACKS.find((p) => p.id === 'baltic-west')!;
    expect(validateRegionPack(balticWest).tileCount).toBeGreaterThan(MAX_TILE_COUNT);
  });

  it('replaces the former baltic-west macro region with smaller corridor packs', () => {
    const legacyWest = LEGACY_REGION_PACKS.find((p) => p.id === 'baltic-west')!;
    const replacements = ['kattegat-north', 'kattegat-south', 'danish-belts', 'oresund', 'bornholm'];
    const replacementPacks = REGION_PACKS.filter((p) => replacements.includes(p.id));
    expect(replacementPacks).toHaveLength(5);
    for (const pack of replacementPacks) {
      expect(validateRegionPack(pack).ok).toBe(true);
    }
    const legacyTiles = validateRegionPack(legacyWest).tileCount;
    const replacementTiles = replacementPacks.reduce((sum, p) => sum + validateRegionPack(p).tileCount, 0);
    expect(legacyTiles).toBeGreaterThan(replacementTiles * 2);
  });
});
