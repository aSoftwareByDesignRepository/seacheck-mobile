import { buildPlanningPassageGeoJson } from '../src/features/map/MapOverlays';

describe('buildPlanningPassageGeoJson', () => {
  it('builds leg lines and waypoint points with selection flag', () => {
    const geojson = buildPlanningPassageGeoJson(
      [
        { id: 'a', longitude: 10.0, latitude: 54.0 },
        { id: 'b', longitude: 10.1, latitude: 54.01 },
        { id: 'c', longitude: 10.2, latitude: 54.02 },
      ],
      'b',
    );
    expect(geojson.features.filter((f) => f.properties?.kind === 'planning-leg')).toHaveLength(2);
    const points = geojson.features.filter((f) => f.properties?.kind === 'planning-wp');
    expect(points).toHaveLength(3);
    expect(points.find((f) => f.properties?.selected === true)).toBeTruthy();
  });
});
