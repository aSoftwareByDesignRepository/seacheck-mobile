import { buildChartStyleSpec, toMapLibreStyleUri } from '../src/map/chartStyle';
import { CHART_BASE_TILE_URL } from '../src/lib/settings/chartBaseStyle';

describe('buildChartStyleSpec', () => {
  it('includes Carto base and OpenSeaMap seamark sources', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['carto-base']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.tiles?.[0]).toContain('openseamap.org/seamark');
  });

  it('uses Voyager base tile URL', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['carto-base']?.tiles?.[0]).toBe(CHART_BASE_TILE_URL);
  });

  it('orders layers: background, base, seamarks', () => {
    const spec = buildChartStyleSpec();
    const ids = spec.layers?.map((layer) => layer.id);
    expect(ids).toEqual(['background', 'carto-base-layer', 'openseamap-seamarks-layer']);
  });

  it('normalizes absolute paths to file URIs for MapLibre offline', () => {
    expect(toMapLibreStyleUri('/data/user/0/app/map/chart-style.json')).toBe(
      'file:///data/user/0/app/map/chart-style.json',
    );
    expect(toMapLibreStyleUri('file:///data/chart-style.json')).toBe('file:///data/chart-style.json');
  });
});
