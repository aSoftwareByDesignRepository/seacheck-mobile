import {
  buildCourseVectorGeometry,
  courseVectorLengthNm,
  COURSE_VECTOR_MAX_NM,
  COURSE_VECTOR_STUB_NM,
} from '../src/lib/geo/courseVector';

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

  it('builds line and wedge when bearing is known', () => {
    const geom = buildCourseVectorGeometry({
      latitude: 54.3,
      longitude: 10.1,
      speedKn: 6,
      bearingDeg: 90,
    });
    expect(geom).not.toBeNull();
    expect(geom!.line[0]).toEqual([10.1, 54.3]);
    expect(geom!.line[1][0]).toBeGreaterThan(10.1);
    expect(geom!.wedge.length).toBe(5);
    expect(geom!.lengthNm).toBeGreaterThan(0);
  });

  it('normalizes bearing to 0–360', () => {
    const geom = buildCourseVectorGeometry({
      latitude: 54.3,
      longitude: 10.1,
      speedKn: 3,
      bearingDeg: -10,
    });
    expect(geom).not.toBeNull();
    expect(geom!.line[1][1]).toBeCloseTo(geom!.line[0][1], 2);
  });
});
