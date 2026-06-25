import {
  buildCourseVectorGeometry,
  courseVectorLengthNm,
  courseVectorVisualLengthNm,
  COURSE_VECTOR_MAX_NM,
  COURSE_VECTOR_STUB_NM,
} from '../src/lib/geo/courseVector';
import { BOAT_BOW_OFFSET_NM } from '../src/lib/geo/boatIcon';
import { distanceNm } from '../src/lib/geo/navigation';

describe('courseVector', () => {
  it('projects length from SOG over six minutes', () => {
    expect(courseVectorLengthNm(6)).toBeCloseTo(0.6, 2);
    expect(courseVectorLengthNm(12)).toBeCloseTo(1.2, 2);
  });

  it('uses stub length when stopped', () => {
    expect(courseVectorLengthNm(0)).toBe(COURSE_VECTOR_STUB_NM);
    expect(courseVectorLengthNm(null)).toBe(COURSE_VECTOR_STUB_NM);
  });

  it('caps projection at max NM', () => {
    expect(courseVectorLengthNm(200)).toBe(COURSE_VECTOR_MAX_NM);
  });

  it('scales visual length for chart prominence', () => {
    expect(courseVectorVisualLengthNm(0.6, 6, 'standard')).toBeCloseTo(0.6, 2);
    expect(courseVectorVisualLengthNm(0.6, 6, 'long')).toBeCloseTo(0.9, 2);
    expect(courseVectorVisualLengthNm(0.6, 6, 'extra')).toBeCloseTo(1.2, 2);
  });

  it('returns null without bearing', () => {
    expect(
      buildCourseVectorGeometry({
        latitude: 54.3,
        longitude: 10.1,
        speedKn: 5,
        bearingDeg: null,
      }),
    ).toBeNull();
  });

  it('builds line and arrowhead from bow when bearing is known', () => {
    const geom = buildCourseVectorGeometry({
      latitude: 54.3,
      longitude: 10.1,
      speedKn: 6,
      bearingDeg: 90,
    });
    expect(geom).not.toBeNull();
    expect(geom!.line[0][0]).toBeGreaterThan(10.1);
    expect(geom!.line[1][0]).toBeGreaterThan(geom!.line[0][0]);
    expect(geom!.arrowhead.length).toBeGreaterThan(3);
    expect(geom!.lengthNm).toBeGreaterThan(0);
    expect(geom!.visualLengthNm).toBeGreaterThanOrEqual(geom!.lengthNm);
  });

  it('starts line ahead of GPS centre at the bow', () => {
    const center: [number, number] = [10.1, 54.3];
    const geom = buildCourseVectorGeometry({
      latitude: 54.3,
      longitude: 10.1,
      speedKn: 6,
      bearingDeg: 0,
    });
    expect(geom).not.toBeNull();
    expect(distanceNm(center, geom!.line[0])).toBeCloseTo(BOAT_BOW_OFFSET_NM, 2);
  });

  it('normalizes bearing to 0–360', () => {
    const geom = buildCourseVectorGeometry({
      latitude: 54.3,
      longitude: 10.1,
      speedKn: 3,
      bearingDeg: -10,
    });
    expect(geom).not.toBeNull();
    expect(geom!.line[1][1]).toBeGreaterThan(geom!.line[0][1]);
  });
});
