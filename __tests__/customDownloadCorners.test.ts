import {
  boundsFromPoints,
  nearestDownloadCorner,
  rectangleCornersFromBounds,
  type DownloadCorner,
} from '../src/lib/map/customDownloadCorners';

describe('customDownloadCorners', () => {
  it('builds bounds from multiple points', () => {
    const bounds = boundsFromPoints([
      { latitude: 54.3, longitude: 10.0 },
      { latitude: 54.5, longitude: 10.2 },
      { latitude: 54.4, longitude: 10.15 },
    ]);
    expect(bounds).toEqual([10.0, 54.3, 10.2, 54.5]);
  });

  it('creates clockwise rectangle corners from bounds', () => {
    const corners = rectangleCornersFromBounds([10.0, 54.3, 10.2, 54.5]);
    expect(corners).toEqual([
      { latitude: 54.3, longitude: 10.0 },
      { latitude: 54.3, longitude: 10.2 },
      { latitude: 54.5, longitude: 10.2 },
      { latitude: 54.5, longitude: 10.0 },
    ]);
  });

  it('picks the nearest corner within radius', () => {
    const corners: DownloadCorner[] = [
      { id: 'a', index: 1, latitude: 54.3, longitude: 10.0 },
      { id: 'b', index: 2, latitude: 54.3, longitude: 10.2 },
    ];
    const hit = nearestDownloadCorner(54.3001, 10.0001, corners);
    expect(hit?.id).toBe('a');
  });
});
