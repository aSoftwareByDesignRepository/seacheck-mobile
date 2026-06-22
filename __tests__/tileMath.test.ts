import { estimateTileCount } from '../src/map/tileMath';

describe('tileMath', () => {
  it('estimates tile count for Kiel bbox', () => {
    const count = estimateTileCount([10.05, 54.22, 10.25, 54.42], 10, 12);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(5000);
  });
});
