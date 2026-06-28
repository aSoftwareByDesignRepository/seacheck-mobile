import {
  assessLegWaypointArrival,
  computePassageLegAdvance,
  LEG_PASS_ALONG_TRACK_MARGIN_NM,
  shouldResetLegArrivalLatch,
} from '../src/lib/passage/legArrival';

const leg = (
  fromName: string,
  fromLat: number,
  fromLon: number,
  toName: string,
  toLat: number,
  toLon: number,
) => ({
  from: { name: fromName, latitude: fromLat, longitude: fromLon },
  to: { name: toName, latitude: toLat, longitude: toLon },
});

describe('legArrival', () => {
  it('detects proximity arrival within the radius', () => {
    const from: [number, number] = [10.0, 54.0];
    const to: [number, number] = [10.0, 54.01];
    const near: [number, number] = [10.0, 54.0099];
    const result = assessLegWaypointArrival(near, from, to, 0.25);
    expect(result.arrived).toBe(true);
    expect(result.reason).toBe('proximity');
  });

  it('detects along-track pass when tacking without entering the circle', () => {
    const from: [number, number] = [10.0, 54.0];
    const to: [number, number] = [10.0, 54.01];
    const abeamPast: [number, number] = [10.008, 54.01];
    const result = assessLegWaypointArrival(abeamPast, from, to, 0.1);
    expect(result.arrived).toBe(true);
    expect(result.reason).toBe('passed_along_track');
    expect(result.distanceToWaypointNm).toBeGreaterThan(0.1);
  });

  it('does not mark arrival when still approaching on the leg', () => {
    const from: [number, number] = [10.0, 54.0];
    const to: [number, number] = [10.0, 54.01];
    const mid: [number, number] = [10.0, 54.005];
    const result = assessLegWaypointArrival(mid, from, to, 0.1);
    expect(result.arrived).toBe(false);
  });

  it('chains leg advance when a shortcut passes multiple waypoints', () => {
    const legs = [
      leg('A', 54.0, 10.0, 'B', 54.01, 10.0),
      leg('B', 54.01, 10.0, 'C', 54.01, 10.02),
    ];
    const shortcutPastBoth: [number, number] = [10.04, 54.01];
    const advance = computePassageLegAdvance(shortcutPastBoth, legs, 0, 0.1);
    expect(advance?.completedLegIndex).toBe(1);
    expect(advance?.nextLegIndex).toBe(1);
    expect(advance?.waypointName).toBe('C');
  });

  it('resets latch when clearly before the waypoint again', () => {
    const from: [number, number] = [10.0, 54.0];
    const to: [number, number] = [10.0, 54.01];
    const mid = assessLegWaypointArrival([10.0, 54.005], from, to, 0.1);
    expect(shouldResetLegArrivalLatch(mid, 0.1)).toBe(true);
  });

  it('does not pass along-track at leg start on very short legs', () => {
    const from: [number, number] = [10.12, 54.32];
    const to: [number, number] = [10.121, 54.321];
    const midApproach: [number, number] = [10.12005, 54.32005];
    const atStart = assessLegWaypointArrival(midApproach, from, to, 0.001);
    expect(atStart.arrived).toBe(false);
  });

  it('uses a positive pass threshold for very short legs', () => {
    const from: [number, number] = [10.12, 54.32];
    const to: [number, number] = [10.121, 54.321];
    const assessment = assessLegWaypointArrival(from, from, to, 0.1);
    expect(assessment.legLengthNm).toBeGreaterThan(0);
    expect(LEG_PASS_ALONG_TRACK_MARGIN_NM).toBeLessThan(assessment.legLengthNm);
  });
});
