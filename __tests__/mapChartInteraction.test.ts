import { mapChartHasOpenDetail, pickMapChartFeatures, resolveMapChartTapAction, resolvePlanningMapTapAction } from '../src/lib/map/mapChartInteraction';
import type { TrackPointRow, WaypointRow } from '../src/lib/db/database';

const waypoint = (id: string, lat: number, lon: number): WaypointRow =>
  ({
    id,
    name: id,
    latitude: lat,
    longitude: lon,
    type: 'generic',
    notes: null,
    created_at: '',
    updated_at: '',
  }) as WaypointRow;

const trackPoint = (id: string, lat: number, lon: number): TrackPointRow =>
  ({
    id,
    track_id: 't1',
    latitude: lat,
    longitude: lon,
    recorded_at: '',
    sog_kn: null,
    cog_deg: null,
  }) as TrackPointRow;

describe('mapChartInteraction', () => {
  it('prefers passage waypoint over saved waypoint at same location', () => {
    const lat = 54.32;
    const lon = 10.14;
    const pick = pickMapChartFeatures(lat, lon, {
      savedWaypoints: [waypoint('saved', lat, lon)],
      passageWaypoints: [waypoint('passage', lat, lon)],
      recordingTrackId: null,
      liveInspectPoints: [],
      mapPreviewPoints: [],
    });
    expect(pick.kind).toBe('waypoint');
    if (pick.kind === 'waypoint') expect(pick.waypoint.id).toBe('passage');
  });

  it('planning tap adds waypoint only on empty chart', () => {
    const action = resolvePlanningMapTapAction(
      54.32,
      10.14,
      { savedWaypoints: [], passageWaypoints: [], recordingTrackId: null, liveInspectPoints: [], mapPreviewPoints: [] },
      false,
    );
    expect(action).toEqual({ action: 'add-waypoint' });
  });

  it('planning tap opens passage waypoint before adding', () => {
    const lat = 54.32;
    const lon = 10.14;
    const action = resolvePlanningMapTapAction(
      lat,
      lon,
      {
        savedWaypoints: [],
        passageWaypoints: [waypoint('passage-wp', lat, lon)],
        recordingTrackId: null,
        liveInspectPoints: [],
        mapPreviewPoints: [],
      },
      false,
    );
    expect(action).toEqual({ action: 'open-waypoint', waypoint: expect.objectContaining({ id: 'passage-wp' }) });
  });

  it('prefers waypoint over track points', () => {
    const lat = 54.32;
    const lon = 10.14;
    const pick = pickMapChartFeatures(lat, lon, {
      savedWaypoints: [waypoint('wp1', lat, lon)],
      recordingTrackId: 't1',
      liveInspectPoints: [trackPoint('tp1', lat, lon)],
      mapPreviewPoints: [],
    });
    expect(pick.kind).toBe('waypoint');
    if (pick.kind === 'waypoint') expect(pick.waypoint.id).toBe('wp1');
  });

  it('returns none when nothing is within pick radius', () => {
    const pick = pickMapChartFeatures(54.32, 10.14, {
      savedWaypoints: [waypoint('wp1', 55, 11)],
      recordingTrackId: null,
      liveInspectPoints: [],
      mapPreviewPoints: [],
    });
    expect(pick).toEqual({ kind: 'none' });
  });

  it('detects open detail sheets', () => {
    expect(mapChartHasOpenDetail({ seamarkHit: null, waypointHit: null, trackPointHit: null })).toBe(false);
    expect(mapChartHasOpenDetail({ seamarkHit: { name: 'x' }, waypointHit: null, trackPointHit: null })).toBe(true);
  });

  it('short tap opens waypoint when within pick radius', () => {
    const lat = 54.32;
    const lon = 10.14;
    const action = resolveMapChartTapAction(
      lat,
      lon,
      {
        savedWaypoints: [waypoint('wp1', lat, lon)],
        recordingTrackId: null,
        liveInspectPoints: [],
        mapPreviewPoints: [],
      },
      false,
    );
    expect(action).toEqual({ action: 'open-waypoint', waypoint: expect.objectContaining({ id: 'wp1' }) });
  });

  it('short tap dismisses details on empty chart', () => {
    expect(
      resolveMapChartTapAction(54.32, 10.14, { savedWaypoints: [], recordingTrackId: null, liveInspectPoints: [], mapPreviewPoints: [] }, true),
    ).toEqual({ action: 'dismiss-details' });
  });

  it('short tap does nothing on empty chart without open details', () => {
    expect(
      resolveMapChartTapAction(54.32, 10.14, { savedWaypoints: [], recordingTrackId: null, liveInspectPoints: [], mapPreviewPoints: [] }, false),
    ).toEqual({ action: 'none' });
  });
});
