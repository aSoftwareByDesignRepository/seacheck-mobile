import { KIEL_CENTER, MAP_ATTRIBUTION, TILE_URLS } from '../src/map/constants';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../src/map/previewConstants';
import { CHART_BASE_TILE_URL, SEAMARK_TILE_URL } from '../src/lib/settings/chartBaseStyle';

describe('map constants', () => {
  it('exposes Kiel default center and attribution', () => {
    expect(KIEL_CENTER).toEqual([10.141, 54.323]);
    expect(MAP_ATTRIBUTION).toMatch(/OpenStreetMap/);
    expect(MAP_EMBED_PREVIEW_HEIGHT).toBe(240);
  });

  it('aliases TILE_URLS to chart base + seamark templates', () => {
    expect(TILE_URLS.base).toBe(CHART_BASE_TILE_URL);
    expect(TILE_URLS.seamarks).toBe(SEAMARK_TILE_URL);
  });
});
