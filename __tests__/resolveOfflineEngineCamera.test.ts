import { resolveOfflineEngineCamera } from '../src/lib/offline/resolveOfflineEngineCamera';
import { REGION_PACKS } from '../src/map/regionPacks';

describe('resolveOfflineEngineCamera', () => {
  it('uses the default Baltic camera when no download is active', () => {
    expect(resolveOfflineEngineCamera(null, {})).toEqual({
      center: [10.15, 54.32],
      zoom: 10,
    });
  });

  it('targets the active region pack bounds', () => {
    const kiel = REGION_PACKS.find((p) => p.id === 'kiel-bay')!;
    expect(resolveOfflineEngineCamera('kiel-bay', {})).toEqual({
      center: [10.15, 54.32],
      zoom: kiel.minZoom,
    });
  });

  it('targets custom download bounds', () => {
    const bounds = [8.1, 53.4, 8.3, 53.6] as const;
    expect(resolveOfflineEngineCamera('custom_abc', { custom_abc: [...bounds] })).toEqual({
      center: [8.2, 53.5],
      zoom: 10,
    });
  });
});
