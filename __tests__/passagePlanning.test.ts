import { clampPlannedSogKn, computePassageLegs, legOverrideKey } from '../src/lib/passage/computeLegs';
import type { WaypointRow } from '../src/lib/db/database';
import { buildPassageRouteGpx, buildPassageSummaryText } from '../src/lib/gpx/gpx';
import { boundsFromWaypoints } from '../src/lib/map/passageBounds';

function wp(id: string, name: string, lat: number, lon: number): WaypointRow {
  return { id, name, latitude: lat, longitude: lon, type: 'harbour', note: '', created_at: 0 };
}

describe('computePassageLegs', () => {
  const waypoints = [wp('a', 'A', 54.32, 10.14), wp('b', 'B', 54.5, 11.0), wp('c', 'C', 55.0, 12.0)];

  it('computes rhumb legs with default SOG', () => {
    const legs = computePassageLegs(waypoints, 5, null);
    expect(legs).toHaveLength(2);
    expect(legs[0].from.name).toBe('A');
    expect(legs[0].sogKn).toBe(5);
    expect(legs[1].cumulativeNm).toBeGreaterThan(legs[0].distanceNm);
  });

  it('applies per-leg SOG override', () => {
    const overrides = { [legOverrideKey('a', 'b')]: { sogKn: 3 } };
    const legs = computePassageLegs(waypoints, 5, null, overrides);
    expect(legs[0].sogKn).toBe(3);
    expect(legs[0].durationHours).toBeGreaterThan(legs[1].durationHours / legs[1].sogKn);
    expect(legs[1].sogKn).toBe(5);
  });

  it('computes ETAs from departure', () => {
    const departure = Date.parse('2026-06-22T08:00:00.000Z');
    const legs = computePassageLegs(waypoints.slice(0, 2), 5, departure);
    expect(legs[0].etaUtc).toMatch(/^2026-06-22T/);
  });
});

describe('clampPlannedSogKn', () => {
  it('clamps invalid values', () => {
    expect(clampPlannedSogKn(0)).toBe(5);
    expect(clampPlannedSogKn(100)).toBe(50);
    expect(clampPlannedSogKn(4.2)).toBe(4.2);
  });
});

describe('passage GPX export', () => {
  it('builds route GPX with waypoints and legs', () => {
    const gpx = buildPassageRouteGpx(
      'Test passage',
      [
        { name: 'A', latitude: 54.32, longitude: 10.14 },
        { name: 'B', latitude: 54.5, longitude: 11.0 },
      ],
      [{ from: { name: 'A', latitude: 54.32, longitude: 10.14 }, to: { name: 'B', latitude: 54.5, longitude: 11.0 } }],
    );
    expect(gpx).toContain('<rte>');
    expect(gpx).toContain('<wpt lat="54.320000" lon="10.140000">');
    expect(gpx).toContain('Test passage');
  });

  it('builds readable summary text', () => {
    const text = buildPassageSummaryText('Trip', [
      {
        fromName: 'A',
        toName: 'B',
        bearingDeg: 90,
        distanceNm: 10,
        cumulativeNm: 10,
        sogKn: 5,
        durationHours: 2,
        etaUtc: '2026-06-22T10:00:00.000Z',
        note: '',
      },
    ], 10, 2);
    expect(text).toContain('Trip');
    expect(text).toContain('A → B');
    expect(text).toContain('Total: 10.0 NM');
  });
});

describe('boundsFromWaypoints', () => {
  it('returns padded bounds for two points', () => {
    const bounds = boundsFromWaypoints([
      { latitude: 54, longitude: 10 },
      { latitude: 55, longitude: 12 },
    ]);
    expect(bounds).not.toBeNull();
    expect(bounds![0]).toBeLessThan(10);
    expect(bounds![2]).toBeGreaterThan(12);
  });
});
