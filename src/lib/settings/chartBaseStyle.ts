/** Offline-capable Carto raster bases — we control tile URLs and MapLibre style. */
export type ChartBaseStyle = 'voyager' | 'light';

export const CHART_BASE_STYLE_OPTIONS: readonly ChartBaseStyle[] = ['voyager', 'light'];

export const DEFAULT_CHART_BASE_STYLE: ChartBaseStyle = 'voyager';

export function normalizeChartBaseStyle(value: unknown): ChartBaseStyle {
  if (value === 'voyager' || value === 'light') return value;
  return DEFAULT_CHART_BASE_STYLE;
}

export function chartBaseStyleTileUrl(style: ChartBaseStyle): string {
  return style === 'light'
    ? 'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png'
    : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
}
