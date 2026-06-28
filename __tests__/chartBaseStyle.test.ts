import {
  CHART_BASE_STYLE_OPTIONS,
  DEFAULT_CHART_BASE_STYLE,
  chartBaseStyleTileUrl,
  normalizeChartBaseStyle,
} from '../src/lib/settings/chartBaseStyle';

describe('chartBaseStyle', () => {
  it('defaults to voyager', () => {
    expect(DEFAULT_CHART_BASE_STYLE).toBe('voyager');
    expect(CHART_BASE_STYLE_OPTIONS).toEqual(['voyager', 'light']);
  });

  it('normalizes unknown values to voyager', () => {
    expect(normalizeChartBaseStyle(undefined)).toBe('voyager');
    expect(normalizeChartBaseStyle('satellite')).toBe('voyager');
    expect(normalizeChartBaseStyle(null)).toBe('voyager');
  });

  it('accepts valid styles', () => {
    expect(normalizeChartBaseStyle('light')).toBe('light');
    expect(normalizeChartBaseStyle('voyager')).toBe('voyager');
  });

  it('returns distinct Carto tile URLs', () => {
    expect(chartBaseStyleTileUrl('voyager')).toContain('/voyager/');
    expect(chartBaseStyleTileUrl('light')).toContain('/light_all/');
    expect(chartBaseStyleTileUrl('voyager')).not.toBe(chartBaseStyleTileUrl('light'));
  });
});
