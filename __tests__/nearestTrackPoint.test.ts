import type { TrackPointRow } from '../src/lib/db/database';
import { nearestTrackPoint, TRACK_MAP_PICK_RADIUS_NM } from '../src/lib/geo/nearestTrackPoint';

function pt(id: string, lat: number, lon: number, recorded_at = 1_700_000_000_000): TrackPointRow {
  return { id, track_id: 'trk1', latitude: lat, longitude: lon, sog_ms: 2.572, cog_deg: 90, recorded_at };
}

describe('nearestTrackPoint', () => {
  const points = [pt('p1', 54.0, 10.0), pt('p2', 54.001, 10.001), pt('p3', 54.002, 10.002)];

  it('returns null when no points', () => {
    expect(nearestTrackPoint(54, 10, [])).toBeNull();
  });

  it('picks closest vertex within radius', () => {
    const hit = nearestTrackPoint(54.0, 10.0, points);
    expect(hit?.point.id).toBe('p1');
    expect(hit!.distanceNm).toBeLessThan(TRACK_MAP_PICK_RADIUS_NM);
  });

  it('picks point on segment between fixes', () => {
    const tight = [pt('a', 54.0, 10.0), pt('b', 54.00008, 10.00008)];
    const hit = nearestTrackPoint(54.00004, 10.00004, tight);
    expect(hit).not.toBeNull();
    expect(['a', 'b']).toContain(hit!.point.id);
  });

  it('returns null when tap is far from track', () => {
    expect(nearestTrackPoint(55, 11, points)).toBeNull();
  });
});
