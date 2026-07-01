import { CHART_BASE_TILE_URL } from '../src/lib/settings/chartBaseStyle';

describe('chartBaseStyle', () => {
  it('uses Carto Voyager raster tiles', () => {
    expect(CHART_BASE_TILE_URL).toContain('/voyager/');
    expect(CHART_BASE_TILE_URL).toContain('{z}/{x}/{y}.png');
  });
});
