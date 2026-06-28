import { selectHasReadyOfflinePack, shouldShowChartRasterTiles } from '../src/lib/map/chartRasterVisibility';

describe('chartRasterVisibility', () => {
  it('shows raster tiles whenever online', () => {
    expect(shouldShowChartRasterTiles(false, false, false)).toBe(true);
    expect(shouldShowChartRasterTiles(false, true, false)).toBe(true);
  });

  it('hides raster tiles offline without a ready pack', () => {
    expect(shouldShowChartRasterTiles(true, false, false)).toBe(false);
  });

  it('hides raster tiles offline outside downloaded coverage', () => {
    expect(shouldShowChartRasterTiles(true, true, false)).toBe(false);
  });

  it('shows raster tiles offline inside downloaded coverage', () => {
    expect(shouldShowChartRasterTiles(true, true, true)).toBe(true);
  });

  it('selectHasReadyOfflinePack tracks region states', () => {
    expect(selectHasReadyOfflinePack({ a: { state: 'idle' } })).toBe(false);
    expect(selectHasReadyOfflinePack({ a: { state: 'ready' } })).toBe(true);
  });
});
