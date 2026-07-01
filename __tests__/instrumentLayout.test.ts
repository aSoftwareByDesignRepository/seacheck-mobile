import {
  compactChipMinHeight,
  computeMinimalInstrumentDockHeight,
  computeMinimalPassageInstrumentDockHeight,
  heroChipMinHeight,
  instrumentHeroSizeForFormFactor,
} from '../src/ui/instrumentLayout';
import {
  MINIMAL_INSTRUMENT_DOCK_HEIGHT,
  MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT,
} from '../src/features/map/mapChromeLayout';

describe('instrumentLayout', () => {
  it('derives compact hero chip height from font metrics', () => {
    expect(heroChipMinHeight(28, true)).toBe(84);
    expect(heroChipMinHeight(28, false)).toBe(68);
  });

  it('exports minimal dock heights consistent with layout math', () => {
    const hero = instrumentHeroSizeForFormFactor('compact');
    expect(MINIMAL_INSTRUMENT_DOCK_HEIGHT).toBe(computeMinimalInstrumentDockHeight(8, hero));
    expect(MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT).toBe(computeMinimalPassageInstrumentDockHeight(8, hero));
    expect(MINIMAL_PASSAGE_INSTRUMENT_DOCK_HEIGHT).toBeGreaterThan(MINIMAL_INSTRUMENT_DOCK_HEIGHT);
    expect(compactChipMinHeight()).toBeLessThan(heroChipMinHeight(hero, true));
  });
});
