import { HIDDEN_MAP_ENGINE_SIZE_PX } from '../src/lib/map/hiddenMapEngineLayout';

describe('hiddenMapEngineLayout', () => {
  it('keeps Android MapLibre hosts small enough to avoid fullscreen TextureView blackout', () => {
    expect(HIDDEN_MAP_ENGINE_SIZE_PX).toBeGreaterThanOrEqual(128);
    expect(HIDDEN_MAP_ENGINE_SIZE_PX).toBeLessThanOrEqual(512);
  });
});
