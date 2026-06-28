import { splitPlanningDuration } from '../src/lib/geo/measureDuration';
import { computePathDistanceNm } from '../src/lib/geo/pathDistance';
import { legDurationHours } from '../src/lib/geo/navigation';
import { resetMeasureDistanceStoreForTests, useMeasureDistanceStore } from '../src/store/measureDistanceStore';

describe('measureDistanceStore', () => {
  beforeEach(() => {
    resetMeasureDistanceStoreForTests();
  });

  it('starts inactive with empty points', () => {
    expect(useMeasureDistanceStore.getState().active).toBe(false);
    expect(useMeasureDistanceStore.getState().points).toEqual([]);
  });

  it('collects points while active', () => {
    useMeasureDistanceStore.getState().start();
    useMeasureDistanceStore.getState().addPoint(54.3, 10.1);
    useMeasureDistanceStore.getState().addPoint(54.4, 10.2);
    expect(useMeasureDistanceStore.getState().points).toHaveLength(2);
    const total = computePathDistanceNm(useMeasureDistanceStore.getState().points);
    expect(total).toBeGreaterThan(0);
  });

  it('ignores points when inactive', () => {
    useMeasureDistanceStore.getState().addPoint(54.3, 10.1);
    expect(useMeasureDistanceStore.getState().points).toHaveLength(0);
  });

  it('undoes the last point', () => {
    useMeasureDistanceStore.getState().start();
    useMeasureDistanceStore.getState().addPoint(54.3, 10.1);
    useMeasureDistanceStore.getState().addPoint(54.4, 10.2);
    useMeasureDistanceStore.getState().undoLast();
    expect(useMeasureDistanceStore.getState().points).toHaveLength(1);
  });

  it('clears on stop', () => {
    useMeasureDistanceStore.getState().start();
    useMeasureDistanceStore.getState().addPoint(54.3, 10.1);
    useMeasureDistanceStore.getState().stop();
    expect(useMeasureDistanceStore.getState().active).toBe(false);
    expect(useMeasureDistanceStore.getState().points).toEqual([]);
  });
});

describe('splitPlanningDuration', () => {
  it('splits fractional hours into hours and minutes', () => {
    expect(splitPlanningDuration(2.5)).toEqual({ hours: 2, minutes: 30 });
    expect(splitPlanningDuration(0)).toEqual({ hours: 0, minutes: 0 });
  });

  it('estimates duration from rhumb distance and SOG', () => {
    const points = [
      { latitude: 54.0, longitude: 10.0 },
      { latitude: 54.5, longitude: 10.0 },
    ];
    const nm = computePathDistanceNm(points);
    const hours = legDurationHours(nm, 5);
    expect(hours).toBeGreaterThan(0);
    expect(splitPlanningDuration(hours).hours).toBeGreaterThanOrEqual(0);
  });
});
