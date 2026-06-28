import { parseCoordField } from '../src/lib/map/coordInput';
import { notifyPassagePlanningChanged } from '../src/lib/passage/passageMapPlanning';
import { resetPassageMapPlanningStoreForTests, usePassageMapPlanningStore } from '../src/store/passageMapPlanningStore';

describe('coordInput', () => {
  it('parses decimal coordinates with comma or dot', () => {
    expect(parseCoordField('54.321')).toBe(54.321);
    expect(parseCoordField('10,14')).toBe(10.14);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseCoordField('')).toBeNull();
    expect(parseCoordField('abc')).toBeNull();
  });
});

describe('passageMapPlanningStore', () => {
  afterEach(() => {
    resetPassageMapPlanningStoreForTests();
  });

  it('tracks planning session and revision bumps', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
    expect(usePassageMapPlanningStore.getState().passageId).toBe('pass-1');
    usePassageMapPlanningStore.getState().bumpRevision();
    expect(usePassageMapPlanningStore.getState().revision).toBe(1);
    usePassageMapPlanningStore.getState().stopPlanning();
    expect(usePassageMapPlanningStore.getState().passageId).toBeNull();
  });

  it('notifyPassagePlanningChanged bumps only for active passage', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
    notifyPassagePlanningChanged('pass-2');
    expect(usePassageMapPlanningStore.getState().revision).toBe(0);
    notifyPassagePlanningChanged('pass-1');
    expect(usePassageMapPlanningStore.getState().revision).toBe(1);
  });
});
