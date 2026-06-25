import {
  normalizeAnchorRadiusNm,
  normalizeCourseVectorMinutes,
  normalizeCourseVectorScale,
  normalizeFollowZoom,
  DEFAULT_ANCHOR_RADIUS_NM,
  DEFAULT_COURSE_VECTOR_MINUTES,
  DEFAULT_COURSE_VECTOR_SCALE,
  DEFAULT_FOLLOW_ZOOM,
} from '../src/lib/settings/mapSettings';

describe('mapSettings', () => {
  it('normalizes course vector minutes to allowed presets', () => {
    expect(normalizeCourseVectorMinutes(3)).toBe(3);
    expect(normalizeCourseVectorMinutes(6)).toBe(6);
    expect(normalizeCourseVectorMinutes(10)).toBe(10);
    expect(normalizeCourseVectorMinutes(15)).toBe(15);
    expect(normalizeCourseVectorMinutes(20)).toBe(20);
    expect(normalizeCourseVectorMinutes(99)).toBe(DEFAULT_COURSE_VECTOR_MINUTES);
    expect(normalizeCourseVectorMinutes(undefined)).toBe(DEFAULT_COURSE_VECTOR_MINUTES);
  });

  it('normalizes course vector visual scale', () => {
    expect(normalizeCourseVectorScale('standard')).toBe('standard');
    expect(normalizeCourseVectorScale('long')).toBe('long');
    expect(normalizeCourseVectorScale('extra')).toBe('extra');
    expect(normalizeCourseVectorScale('invalid')).toBe(DEFAULT_COURSE_VECTOR_SCALE);
  });

  it('normalizes follow zoom to allowed levels', () => {
    expect(normalizeFollowZoom(13)).toBe(13);
    expect(normalizeFollowZoom(16)).toBe(16);
    expect(normalizeFollowZoom(9)).toBe(DEFAULT_FOLLOW_ZOOM);
    expect(normalizeFollowZoom('12')).toBe(12);
  });

  it('normalizes anchor radius to allowed presets', () => {
    expect(normalizeAnchorRadiusNm(0.03)).toBe(0.03);
    expect(normalizeAnchorRadiusNm(0.2)).toBe(0.2);
    expect(normalizeAnchorRadiusNm(0.07)).toBe(DEFAULT_ANCHOR_RADIUS_NM);
    expect(normalizeAnchorRadiusNm(undefined)).toBe(DEFAULT_ANCHOR_RADIUS_NM);
  });
});
