import {
  effectiveMapSplit,
  isInstrumentPanelAllowed,
  resolveMapSafetyChromePlacement,
} from '../src/lib/map/mapScreenLayoutPolicy';

describe('mapScreenLayoutPolicy', () => {
  describe('isInstrumentPanelAllowed', () => {
    it('blocks side panel during planning, download pick, and MOB', () => {
      expect(isInstrumentPanelAllowed({ customSelecting: true, passageMapPlanning: false, hasMobTarget: false })).toBe(false);
      expect(isInstrumentPanelAllowed({ customSelecting: false, passageMapPlanning: true, hasMobTarget: false })).toBe(false);
      expect(isInstrumentPanelAllowed({ customSelecting: false, passageMapPlanning: false, hasMobTarget: true })).toBe(false);
      expect(isInstrumentPanelAllowed({ customSelecting: false, passageMapPlanning: false, hasMobTarget: false })).toBe(true);
    });
  });

  describe('effectiveMapSplit', () => {
    it('requires both tablet landscape capability and panel allowance', () => {
      expect(effectiveMapSplit(true, true)).toBe(true);
      expect(effectiveMapSplit(true, false)).toBe(false);
      expect(effectiveMapSplit(false, true)).toBe(false);
    });
  });

  describe('resolveMapSafetyChromePlacement', () => {
    it('places safety on map pane when split, root when stacked', () => {
      expect(resolveMapSafetyChromePlacement({ showSideActions: false, effectiveSplit: true })).toBe('none');
      expect(resolveMapSafetyChromePlacement({ showSideActions: true, effectiveSplit: true })).toBe('mapPane');
      expect(resolveMapSafetyChromePlacement({ showSideActions: true, effectiveSplit: false })).toBe('root');
    });
  });
});
