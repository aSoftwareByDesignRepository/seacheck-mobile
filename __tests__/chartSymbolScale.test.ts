import {
  BOAT_ICON_LENGTH_NM,
  buildBoatIconPolygon,
  BOAT_BOW_OFFSET_NM,
  scaledBoatBowOffsetNm,
} from '../src/lib/geo/boatIcon';
import { buildCourseVectorGeometry, courseVectorDrawLengthNm } from '../src/lib/geo/courseVector';
import {
  BOAT_ICON_TARGET_LENGTH_PX,
  chartSymbolScaleForZoom,
  pixelLengthToNm,
  symbolScreenLengthPx,
} from '../src/lib/map/chartSymbolScale';
import { distanceNm } from '../src/lib/geo/navigation';

describe('chartSymbolScale', () => {
  const lat = 54.3;

  it('returns 1 at reference zoom when target matches base length', () => {
    const zoom = 13;
    const desiredNm = pixelLengthToNm(BOAT_ICON_TARGET_LENGTH_PX, zoom, lat);
    const scale = chartSymbolScaleForZoom(zoom, lat, BOAT_ICON_TARGET_LENGTH_PX, desiredNm);
    expect(scale).toBeCloseTo(1, 1);
  });

  it('increases scale when zoomed out so the boat stays visible', () => {
    const scale13 = chartSymbolScaleForZoom(13, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    const scale10 = chartSymbolScaleForZoom(10, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    const scale8 = chartSymbolScaleForZoom(8, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    expect(scale10).toBeGreaterThan(scale13);
    expect(scale8).toBeGreaterThan(scale10);
  });

  it('keeps boat at target screen size for passage overview zoom (20–30 NM routes)', () => {
    for (const zoom of [6, 7, 8, 9, 10]) {
      const scale = chartSymbolScaleForZoom(zoom, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
      const screenPx = symbolScreenLengthPx(scale, BOAT_ICON_LENGTH_NM, zoom, lat);
      expect(screenPx).toBeGreaterThanOrEqual(BOAT_ICON_TARGET_LENGTH_PX * 0.92);
      expect(screenPx).toBeLessThanOrEqual(BOAT_ICON_TARGET_LENGTH_PX * 1.08);
    }
  });

  it('expands boat polygon when scale increases', () => {
    const center: [number, number] = [10.1, lat];
    const base = buildBoatIconPolygon(center, 0, 1);
    const large = buildBoatIconPolygon(center, 0, 4);
    expect(distanceNm(center, large[0])).toBeGreaterThan(distanceNm(center, base[0]) * 3);
  });

  it('scales bow offset with symbol scale', () => {
    expect(scaledBoatBowOffsetNm(2)).toBeCloseTo(BOAT_BOW_OFFSET_NM * 2, 6);
  });
});

describe('courseVector zoom compensation', () => {
  it('lengthens drawn vector when zoomed out for minimum screen pixels', () => {
    const baseVisual = 0.55;
    const zoomedOut = courseVectorDrawLengthNm(baseVisual, 7, 54.3);
    expect(zoomedOut).toBeGreaterThan(baseVisual);
  });

  it('builds geometry with chart context at low zoom', () => {
    const geom = buildCourseVectorGeometry(
      { latitude: 54.3, longitude: 10.1, speedKn: 0, bearingDeg: 45 },
      6,
      'long',
      { chartZoom: 7, latitudeDeg: 54.3, symbolScale: 120, arrowheadScale: 120 },
    );
    expect(geom).not.toBeNull();
    expect(geom!.visualLengthNm).toBeGreaterThan(0.55);
    expect(geom!.line[0]).not.toEqual(geom!.line[1]);
  });
});
