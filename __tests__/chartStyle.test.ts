import { buildChartStyleSpec, toMapLibreStyleUri } from '../src/map/chartStyle';
import { CHART_BASE_TILE_URL, CHART_BASE_TILE_URLS } from '../src/lib/settings/chartBaseStyle';

describe('buildChartStyleSpec', () => {
  it('includes OSM base and OpenSeaMap seamark raster sources', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['osm-base']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.type).toBe('raster');
  });

  it('uses OpenSeaMap base tile URLs (primary + fallback)', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['osm-base']?.tiles).toEqual([...CHART_BASE_TILE_URLS]);
    expect(spec.sources?.['osm-base']?.tiles?.[0]).toBe(CHART_BASE_TILE_URL);
  });

  it('orders background, base, then seamarks', () => {
    const spec = buildChartStyleSpec();
    const ids = spec.layers?.map((l) => l.id);
    expect(ids).toEqual(['background', 'osm-base-layer', 'openseamap-seamarks-layer']);
  });
});

describe('toMapLibreStyleUri', () => {
  it('prefixes absolute filesystem paths with file://', () => {
    expect(toMapLibreStyleUri('/data/map/chart-style.json')).toBe('file:///data/map/chart-style.json');
  });

  it('leaves file and https URIs unchanged', () => {
    expect(toMapLibreStyleUri('file:///tmp/style.json')).toBe('file:///tmp/style.json');
    expect(toMapLibreStyleUri('https://example.com/style.json')).toBe('https://example.com/style.json');
  });
});
