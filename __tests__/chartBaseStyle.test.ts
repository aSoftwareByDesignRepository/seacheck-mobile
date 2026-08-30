import { CHART_BASE_TILE_URL, CHART_BASE_TILE_URLS, CHART_BASEMAP_ID } from '../src/lib/settings/chartBaseStyle';

describe('chartBaseStyle', () => {
  it('uses OpenSeaMap OSM raster tiles without an API key', () => {
    expect(CHART_BASEMAP_ID).toBe('openseamap-osm-v1');
    expect(CHART_BASE_TILE_URL).toContain('openseamap.org/tile/');
    expect(CHART_BASE_TILE_URL).toContain('{z}/{x}/{y}.png');
    expect(CHART_BASE_TILE_URL).not.toMatch(/[?&]key=/);
    expect(CHART_BASE_TILE_URLS.length).toBeGreaterThanOrEqual(2);
    expect(CHART_BASE_TILE_URLS[0]).toBe(CHART_BASE_TILE_URL);
  });
});
