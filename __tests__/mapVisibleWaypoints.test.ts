import { mapTappableWaypoints, mobWaypointsOnMap } from '../src/lib/map/mapVisibleWaypoints';
import type { WaypointRow } from '../src/lib/db/database';

const wp = (id: string, type: WaypointRow['type'], lat = 54.32, lon = 10.14): WaypointRow =>
  ({
    id,
    name: id,
    latitude: lat,
    longitude: lon,
    type,
    note: '',
    created_at: '',
  }) as WaypointRow;

describe('mapVisibleWaypoints', () => {
  it('shows only MOB marks on the chart overlay list', () => {
    const items = [wp('a', 'generic'), wp('b', 'mob'), wp('c', 'harbour')];
    expect(mobWaypointsOnMap(items).map((w) => w.id)).toEqual(['b']);
  });

  it('includes MOB marks and active passage waypoints for map taps', () => {
    const saved = [wp('mob1', 'mob'), wp('saved', 'generic')];
    const passage = [wp('leg1', 'generic', 54.33, 10.15)];
    const tappable = mapTappableWaypoints(saved, passage);
    expect(tappable.map((w) => w.id).sort()).toEqual(['leg1', 'mob1']);
  });
});
