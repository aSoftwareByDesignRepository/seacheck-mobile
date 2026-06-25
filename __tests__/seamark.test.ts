import { unknownChartObject } from '../src/lib/seamarks/querySeamark';

describe('seamark helpers', () => {
  it('builds unknown chart object at tap position', () => {
    const hit = unknownChartObject(54.32, 10.14);
    expect(hit.source).toBe('unknown');
    expect(hit.type).toBe('chart_object');
    expect(hit.latitude).toBeCloseTo(54.32, 4);
    expect(hit.longitude).toBeCloseTo(10.14, 4);
  });
});
