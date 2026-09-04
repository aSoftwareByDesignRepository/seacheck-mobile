import {
  claimEmbeddedChartMapSlot,
  hasActiveEmbeddedChartMap,
  releaseEmbeddedChartMapSlot,
  resetEmbeddedChartMapRegistryForTests,
} from '../src/lib/map/embeddedChartMapRegistry';

describe('embeddedChartMapRegistry', () => {
  beforeEach(() => {
    resetEmbeddedChartMapRegistryForTests();
  });

  it('tracks active embedded preview slots', () => {
    expect(hasActiveEmbeddedChartMap()).toBe(false);
    claimEmbeddedChartMapSlot('pack-preview-kiel-bay');
    expect(hasActiveEmbeddedChartMap()).toBe(true);
    claimEmbeddedChartMapSlot('pack-preview-kiel-bay');
    expect(hasActiveEmbeddedChartMap()).toBe(true);
    releaseEmbeddedChartMapSlot('pack-preview-kiel-bay');
    expect(hasActiveEmbeddedChartMap()).toBe(false);
  });
});
