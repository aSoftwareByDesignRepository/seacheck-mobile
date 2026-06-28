import { buildChartStyleSpec } from '../src/map/chartStyle';
import { chartBaseStyleTileUrl } from '../src/lib/settings/chartBaseStyle';

describe('buildChartStyleSpec', () => {
  it('includes Carto base and OpenSeaMap seamark sources', () => {
    const spec = buildChartStyleSpec('voyager');
    expect(spec.sources?.['carto-base']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.tiles?.[0]).toContain('openseamap.org/seamark');
  });

  it('uses the selected base style tile URL', () => {
    const voyager = buildChartStyleSpec('voyager');
    const light = buildChartStyleSpec('light');
    expect(voyager.sources?.['carto-base']?.tiles?.[0]).toBe(chartBaseStyleTileUrl('voyager'));
    expect(light.sources?.['carto-base']?.tiles?.[0]).toBe(chartBaseStyleTileUrl('light'));
  });

  it('orders layers: background, base, seamarks', () => {
    const spec = buildChartStyleSpec('light');
    const ids = spec.layers?.map((layer) => layer.id);
    expect(ids).toEqual(['background', 'carto-base-layer', 'openseamap-seamarks-layer']);
  });
});
