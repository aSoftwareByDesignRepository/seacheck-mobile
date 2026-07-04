import { resolveChartTileProbeCenter } from '../src/lib/network/chartTileProbeCenter';

describe('resolveChartTileProbeCenter', () => {
  it('returns the center of a known region pack', () => {
    const center = resolveChartTileProbeCenter('kiel-bay');
    expect(center).toEqual({ latitude: 54.32, longitude: 10.15 });
  });

  it('returns custom bounds center when present', () => {
    const center = resolveChartTileProbeCenter('custom_abc', {
      custom_abc: [1, 2, 3, 4],
    });
    expect(center).toEqual({ latitude: 3, longitude: 2 });
  });

  it('returns undefined for unknown ids', () => {
    expect(resolveChartTileProbeCenter('missing')).toBeUndefined();
  });
});
