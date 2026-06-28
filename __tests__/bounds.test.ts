import { expandLngLatBounds, normalizeBounds, pointInLngLatBounds, validateDownloadBounds } from '../src/lib/map/bounds';

describe('download bounds', () => {
  it('normalizes corner order', () => {
    const bounds = normalizeBounds(
      { latitude: 54.5, longitude: 10.2 },
      { latitude: 54.3, longitude: 10.0 },
    );
    expect(bounds).toEqual([10.0, 54.3, 10.2, 54.5]);
  });

  it('rejects tiny areas', () => {
    const bounds = normalizeBounds(
      { latitude: 54.32, longitude: 10.14 },
      { latitude: 54.3205, longitude: 10.1405 },
    );
    expect(validateDownloadBounds(bounds, 10, 14).ok).toBe(false);
  });

  it('accepts Kiel-sized box', () => {
    const bounds = normalizeBounds(
      { latitude: 54.42, longitude: 10.05 },
      { latitude: 54.22, longitude: 10.25 },
    );
    const result = validateDownloadBounds(bounds, 10, 14);
    expect(result.ok).toBe(true);
  });

  it('detects points inside antimeridian-crossing bounds', () => {
    const bounds: [number, number, number, number] = [170, -20, -170, 20];
    expect(pointInLngLatBounds(bounds, 0, 175)).toBe(true);
    expect(pointInLngLatBounds(bounds, 0, -175)).toBe(true);
    expect(pointInLngLatBounds(bounds, 0, 0)).toBe(false);
  });

  it('expands bounds near the antimeridian without breaking wrap logic', () => {
    const bounds: [number, number, number, number] = [175, -18, -175, 18];
    const expanded = expandLngLatBounds(bounds, 0.5);
    expect(pointInLngLatBounds(expanded, 0, 179)).toBe(true);
    expect(pointInLngLatBounds(expanded, 0, -179)).toBe(true);
  });
});
