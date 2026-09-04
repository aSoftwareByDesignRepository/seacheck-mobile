import {
  CHART_BASE_TILE_URL,
  CHART_BASE_TILE_URLS,
  CHART_BASEMAP_ID,
  SEAMARK_TILE_URL,
} from '../src/lib/settings/chartBaseStyle';

describe('chartBaseStyle', () => {
  it('uses OSM standard raster tiles without an API key', () => {
    expect(CHART_BASEMAP_ID).toBe('osm-standard-v1');
    expect(CHART_BASE_TILE_URL).toContain('tile.openstreetmap.org');
    expect(CHART_BASE_TILE_URL).toContain('{z}/{x}/{y}.png');
    expect(CHART_BASE_TILE_URL).not.toMatch(/[?&]key=/);
    expect(CHART_BASE_TILE_URLS[0]).toBe(CHART_BASE_TILE_URL);
  });

  it('uses OpenSeaMap seamark overlay URL, not /tile/ placeholders', () => {
    expect(SEAMARK_TILE_URL).toContain('tiles.openseamap.org/seamark/');
    expect(SEAMARK_TILE_URL).not.toContain('/tile/');
  });
});
