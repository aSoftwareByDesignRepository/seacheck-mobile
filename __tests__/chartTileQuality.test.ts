import { isPlaceholderChartTileBytes, MIN_VALID_CHART_TILE_BYTES } from '../src/lib/map/chartTileQuality';

describe('chartTileQuality', () => {
  it('rejects OSM blocked and OpenSeaMap empty placeholder sizes', () => {
    expect(isPlaceholderChartTileBytes(new Uint8Array(103))).toBe(true);
    expect(isPlaceholderChartTileBytes(new Uint8Array(334))).toBe(true);
    expect(isPlaceholderChartTileBytes(new Uint8Array(MIN_VALID_CHART_TILE_BYTES - 1))).toBe(true);
  });

  it('accepts real raster tile payloads', () => {
    expect(isPlaceholderChartTileBytes(new Uint8Array(MIN_VALID_CHART_TILE_BYTES))).toBe(false);
    expect(isPlaceholderChartTileBytes(new Uint8Array(4_096))).toBe(false);
  });
});
