import {
  expandLngLatBounds,
  normalizeBounds,
  pointInLngLatBounds,
  squareBoundsContaining,
  squareBoundsFromAnchor,
  validateDownloadBounds,
} from '../src/lib/map/bounds';

describe('download bounds', () => {
  it('normalizes corner order', () => {
    const bounds = normalizeBounds(
      { latitude: 54.5, longitude: 10.2 },
      { latitude: 54.3, longitude: 10.0 },
    );
    expect(bounds).toEqual([10.0, 54.3, 10.2, 54.5]);
  });

  it('builds a square from anchor and pointer', () => {
    const bounds = squareBoundsFromAnchor(
      { latitude: 54.3, longitude: 10.0 },
      { latitude: 54.36, longitude: 10.08 },
    );
    const [west, south, east, north] = bounds;
    expect(west).toBeCloseTo(10.0, 5);
    expect(south).toBeCloseTo(54.3, 5);
    expect(north - south).toBeCloseTo(east - west, 5);
    expect(east - west).toBeCloseTo(0.08, 5);
  });

  it('expands rectangles to a containing square', () => {
    const square = squareBoundsContaining([10.0, 54.0, 10.3, 54.1]);
    const [west, south, east, north] = square;
    expect(north - south).toBeCloseTo(east - west, 5);
    expect(west).toBeLessThanOrEqual(10.0);
    expect(east).toBeGreaterThanOrEqual(10.3);
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
