import { parseCoordField } from '../src/lib/map/coordInput';
import { notifyPassagePlanningChanged, startPassageMapView } from '../src/lib/passage/passageMapPlanning';
import { resetPassageMapPlanningStoreForTests, usePassageMapPlanningStore } from '../src/store/passageMapPlanningStore';

describe('coordInput', () => {
  it('parses decimal coordinates with comma or dot', () => {
    expect(parseCoordField('54.321')).toBe(54.321);
    expect(parseCoordField('10,14')).toBe(10.14);
    expect(parseCoordField('-12.5')).toBe(-12.5);
  });

  it('returns null for empty, invalid, or partial input', () => {
    expect(parseCoordField('')).toBeNull();
    expect(parseCoordField('abc')).toBeNull();
    expect(parseCoordField('54.32N')).toBeNull();
    expect(parseCoordField('54.32abc')).toBeNull();
  });
});

describe('passageMapPlanningStore', () => {
  afterEach(() => {
    resetPassageMapPlanningStoreForTests();
  });

  it('tracks planning session and revision bumps', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
    expect(usePassageMapPlanningStore.getState().passageId).toBe('pass-1');
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(true);
    usePassageMapPlanningStore.getState().bumpRevision();
    expect(usePassageMapPlanningStore.getState().revision).toBe(1);
    usePassageMapPlanningStore.getState().stopPlanning();
    expect(usePassageMapPlanningStore.getState().passageId).toBeNull();
  });

  it('supports view-only planning for active passages', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-active', { allowRouteEdits: false });
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(false);
    usePassageMapPlanningStore.getState().unlockRouteEdits();
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(true);
  });

  it('notifyPassagePlanningChanged bumps only for active passage', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
    notifyPassagePlanningChanged('pass-2');
    expect(usePassageMapPlanningStore.getState().revision).toBe(0);
    notifyPassagePlanningChanged('pass-1');
    expect(usePassageMapPlanningStore.getState().revision).toBe(1);
  });

  it('startPassageMapView opens read-only planning', async () => {
    await startPassageMapView('pass-view');
    expect(usePassageMapPlanningStore.getState().passageId).toBe('pass-view');
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(false);
  });

  it('resets guide dismissal when a new planning session starts', () => {
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
    usePassageMapPlanningStore.getState().dismissGuideForSession();
    expect(usePassageMapPlanningStore.getState().guideDismissedForSession).toBe(true);
    usePassageMapPlanningStore.getState().startPlanning('pass-2');
    expect(usePassageMapPlanningStore.getState().guideDismissedForSession).toBe(false);
  });
});
