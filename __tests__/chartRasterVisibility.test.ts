import {
  resolveChartMapAlert,
  selectHasReadyOfflinePack,
  shouldShowChartRasterTiles,
} from '../src/lib/map/chartRasterVisibility';

const baseOffline = {
  offlineHydrated: true,
  isOffline: true,
  downloadHintDismissed: false,
  offlineChartAlertDismissed: false,
};

describe('chartRasterVisibility', () => {
  it('always shows raster tiles so MapLibre can serve cache or packs', () => {
    expect(shouldShowChartRasterTiles()).toBe(true);
  });

  it('selectHasReadyOfflinePack tracks region states', () => {
    expect(selectHasReadyOfflinePack({ a: { state: 'idle' } })).toBe(false);
    expect(selectHasReadyOfflinePack({ a: { state: 'ready' } })).toBe(true);
  });

  it('shows cache-only alert offline outside downloaded coverage without packs', () => {
    expect(
      resolveChartMapAlert({
        ...baseOffline,
        hasReadyPack: false,
        chartCovered: false,
      }),
    ).toBe('cacheOnly');
  });

  it('shows coverage alert offline outside pack when packs exist', () => {
    expect(
      resolveChartMapAlert({
        ...baseOffline,
        hasReadyPack: true,
        chartCovered: false,
      }),
    ).toBe('coverage');
  });

  it('hides offline alerts when dismissed for the session', () => {
    expect(
      resolveChartMapAlert({
        ...baseOffline,
        hasReadyPack: false,
        chartCovered: false,
        offlineChartAlertDismissed: true,
      }),
    ).toBeNull();
  });

  it('shows no alert offline inside downloaded coverage', () => {
    expect(
      resolveChartMapAlert({
        ...baseOffline,
        hasReadyPack: true,
        chartCovered: true,
      }),
    ).toBeNull();
  });

  it('shows download hint online without packs until dismissed', () => {
    expect(
      resolveChartMapAlert({
        offlineHydrated: true,
        isOffline: false,
        hasReadyPack: false,
        chartCovered: false,
        downloadHintDismissed: false,
        offlineChartAlertDismissed: false,
      }),
    ).toBe('download');
  });
});
