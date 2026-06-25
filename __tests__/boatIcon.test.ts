import {
  buildBoatIconPolygon,
  buildPositionDiamondPolygon,
  buildPositionDotPolygon,
  BOAT_BOW_OFFSET_NM,
} from '../src/lib/geo/boatIcon';
import { bearingTrue, distanceNm } from '../src/lib/geo/navigation';

describe('boatIcon', () => {
  const center: [number, number] = [10.1, 54.3];

  it('builds a closed boat polygon pointing north', () => {
    const ring = buildBoatIconPolygon(center, 0);
    expect(ring.length).toBeGreaterThan(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(distanceNm(center, ring[0])).toBeCloseTo(BOAT_BOW_OFFSET_NM, 2);
    expect(ring[0][1]).toBeGreaterThan(center[1]);
  });

  it('rotates the bow with bearing', () => {
    const east = buildBoatIconPolygon(center, 90);
    expect(east[0][0]).toBeGreaterThan(center[0]);
    const south = buildBoatIconPolygon(center, 180);
    expect(south[0][1]).toBeLessThan(center[1]);
  });

  it('builds a closed position dot for accuracy rings', () => {
    const ring = buildPositionDotPolygon(center);
    expect(ring.length).toBeGreaterThan(8);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('builds a closed diamond for unknown heading', () => {
    const ring = buildPositionDiamondPolygon(center);
    expect(ring.length).toBe(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0][1]).toBeGreaterThan(center[1]);
    expect(ring[2][1]).toBeLessThan(center[1]);
  });

  it('keeps bow bearing aligned with rhumb line', () => {
    const bearing = 45;
    const ring = buildBoatIconPolygon(center, bearing);
    const bowBearing = bearingTrue(center, ring[0]);
    expect(bowBearing).toBeCloseTo(bearing, 0);
  });
});
