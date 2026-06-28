import { buildPlanningPassageGeoJson } from '../src/features/map/MapOverlays';

describe('buildPlanningPassageGeoJson', () => {
  it('builds leg lines and waypoint points', () => {
    const geojson = buildPlanningPassageGeoJson([
      { longitude: 10.0, latitude: 54.0 },
      { longitude: 10.1, latitude: 54.01 },
      { longitude: 10.2, latitude: 54.02 },
    ]);
    expect(geojson.features.filter((f) => f.properties?.kind === 'planning-leg')).toHaveLength(2);
    expect(geojson.features.filter((f) => f.properties?.kind === 'planning-wp')).toHaveLength(3);
  });
});
