import {
  BOAT_ICON_LENGTH_NM,
  buildBoatIconPolygon,
  BOAT_BOW_OFFSET_NM,
  scaledBoatBowOffsetNm,
} from '../src/lib/geo/boatIcon';
import {
  buildCourseVectorGeometry,
  courseVectorDrawLengthNm,
  courseVectorStubLengthNm,
} from '../src/lib/geo/courseVector';
import {
  BOAT_ICON_TARGET_LENGTH_PX,
  chartSymbolOutlineWidth,
  chartSymbolScaleForZoom,
  clampCourseVectorDrawLengthNm,
  COURSE_VECTOR_STUB_TARGET_PX,
  pixelLengthToNm,
  symbolScreenLengthPx,
  vectorScreenLengthPx,
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

  it('decreases scale when zoomed in so the boat does not grow on screen', () => {
    const scale13 = chartSymbolScaleForZoom(13, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    const scale15 = chartSymbolScaleForZoom(15, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    const scale16 = chartSymbolScaleForZoom(16, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
    expect(scale15).toBeLessThan(scale13);
    expect(scale16).toBeLessThan(scale15);
    expect(scale16).toBeLessThan(1);
  });

  it('keeps boat at target screen size across navigation zoom range', () => {
    for (const zoom of [6, 7, 8, 9, 10, 13, 14, 15, 16]) {
      const scale = chartSymbolScaleForZoom(zoom, lat, BOAT_ICON_TARGET_LENGTH_PX, BOAT_ICON_LENGTH_NM);
      const screenPx = symbolScreenLengthPx(scale, BOAT_ICON_LENGTH_NM, zoom, lat);
      expect(screenPx).toBeGreaterThanOrEqual(BOAT_ICON_TARGET_LENGTH_PX * 0.92);
      expect(screenPx).toBeLessThanOrEqual(BOAT_ICON_TARGET_LENGTH_PX * 1.08);
    }
  });

  it('uses a constant thin outline like chart plotters', () => {
    expect(chartSymbolOutlineWidth(1)).toBe(2);
    expect(chartSymbolOutlineWidth(200)).toBe(2);
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
  const lat = 54.3;

  it('keeps heading stub at fixed screen size at every zoom', () => {
    for (const zoom of [7, 13, 16]) {
      const stub = courseVectorStubLengthNm(zoom, lat);
      const px = vectorScreenLengthPx(stub, zoom, lat);
      expect(px).toBeGreaterThanOrEqual(COURSE_VECTOR_STUB_TARGET_PX * 0.92);
      expect(px).toBeLessThanOrEqual(COURSE_VECTOR_STUB_TARGET_PX * 1.08);
    }
  });

  it('does not cap moving vectors at harbour zoom', () => {
    const movingNm = 0.6;
    const drawn = clampCourseVectorDrawLengthNm(movingNm, 16, lat, { headingStub: false });
    expect(drawn).toBeGreaterThanOrEqual(movingNm);
    expect(vectorScreenLengthPx(drawn, 16, lat)).toBeGreaterThan(100);
  });

  it('builds geometry with chart context at low zoom', () => {
    const geom = buildCourseVectorGeometry(
      { latitude: 54.3, longitude: 10.1, speedKn: 0, bearingDeg: 45 },
      6,
      'long',
      { chartZoom: 7, latitudeDeg: 54.3, symbolScale: 120, arrowheadScale: 120 },
    );
    expect(geom).not.toBeNull();
    expect(geom!.visualLengthNm).toBeGreaterThan(0);
    expect(geom!.line[0]).not.toEqual(geom!.line[1]);
    expect(vectorScreenLengthPx(geom!.visualLengthNm, 7, 54.3)).toBeGreaterThanOrEqual(
      COURSE_VECTOR_STUB_TARGET_PX * 0.92,
    );
  });

  it('applies minimum floor to moving vectors when zoomed out', () => {
    const shortNm = 0.05;
    const drawn = courseVectorDrawLengthNm(shortNm, 8, lat, false);
    expect(vectorScreenLengthPx(drawn, 8, lat)).toBeGreaterThanOrEqual(32);
  });
});
