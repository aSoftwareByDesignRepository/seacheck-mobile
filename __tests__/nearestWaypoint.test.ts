import type { WaypointRow } from '../src/lib/db/database';
import { nearestWaypoint, WAYPOINT_MAP_PICK_RADIUS_NM } from '../src/lib/geo/nearestWaypoint';

function wp(id: string, lat: number, lon: number): WaypointRow {
  return { id, name: id, latitude: lat, longitude: lon, type: 'generic', note: '', created_at: 0 };
}

describe('nearestWaypoint', () => {
  const waypoints = [wp('a', 54.32, 10.14), wp('b', 54.5, 11.0)];

  it('returns closest waypoint within pick radius', () => {
    const hit = nearestWaypoint(54.3201, 10.1401, waypoints);
    expect(hit?.waypoint.id).toBe('a');
    expect(hit!.distanceNm).toBeLessThan(WAYPOINT_MAP_PICK_RADIUS_NM);
  });

  it('returns null when tap is too far from any waypoint', () => {
    expect(nearestWaypoint(55, 12, waypoints)).toBeNull();
  });

  it('prefers closer waypoint when two are in range', () => {
    const close = [wp('near', 54.32, 10.14), wp('far', 54.321, 10.142)];
    const hit = nearestWaypoint(54.32005, 10.14005, close);
    expect(hit?.waypoint.id).toBe('near');
  });
});

describe('useMapShellLayout split logic', () => {
  it('shows floating strip only on phone map-forward', () => {
    const { resolveMapShellSplit } = require('../src/features/responsive/ResponsiveMapShell');
    expect(resolveMapShellSplit('map-forward', 'compact', false)).toEqual({ split: false, row: false });
    expect(resolveMapShellSplit('map-forward', 'expanded', false)).toEqual({ split: true, row: true });
    expect(resolveMapShellSplit('split', 'compact', true)).toEqual({ split: true, row: true });
    expect(resolveMapShellSplit('coordinates', 'compact', false)).toEqual({ split: true, row: false });
  });
});
