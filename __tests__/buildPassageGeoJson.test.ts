import { buildPassageGeoJson } from '../src/features/map/MapOverlays';

describe('buildPassageGeoJson', () => {
  const waypoints = [
    { longitude: 10.0, latitude: 54.0 },
    { longitude: 10.1, latitude: 54.01 },
    { longitude: 10.2, latitude: 54.02 },
    { longitude: 10.3, latitude: 54.03 },
  ];

  it('tags legs as completed, active, or upcoming', () => {
    const geojson = buildPassageGeoJson(waypoints, 1);
    const legs = geojson.features.filter((f) => f.properties?.kind === 'passage-leg');
    expect(legs).toHaveLength(3);
    expect(legs[0]?.properties?.phase).toBe('completed');
    expect(legs[1]?.properties?.phase).toBe('active');
    expect(legs[2]?.properties?.phase).toBe('upcoming');
  });

  it('tags waypoints as passed or upcoming', () => {
    const geojson = buildPassageGeoJson(waypoints, 1);
    const points = geojson.features.filter((f) => f.properties?.kind === 'passage-wp');
    expect(points[0]?.properties?.phase).toBe('passed');
    expect(points[1]?.properties?.phase).toBe('passed');
    expect(points[2]?.properties?.phase).toBe('upcoming');
    expect(points[3]?.properties?.phase).toBe('upcoming');
  });
});
