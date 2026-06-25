import {
  normalizeCourseVectorMinutes,
  normalizeFollowZoom,
  DEFAULT_COURSE_VECTOR_MINUTES,
  DEFAULT_FOLLOW_ZOOM,
} from '../src/lib/settings/mapSettings';

describe('mapSettings', () => {
  it('normalizes course vector minutes to 3, 6, or 10', () => {
    expect(normalizeCourseVectorMinutes(3)).toBe(3);
    expect(normalizeCourseVectorMinutes(6)).toBe(6);
    expect(normalizeCourseVectorMinutes(10)).toBe(10);
    expect(normalizeCourseVectorMinutes(99)).toBe(DEFAULT_COURSE_VECTOR_MINUTES);
    expect(normalizeCourseVectorMinutes(undefined)).toBe(DEFAULT_COURSE_VECTOR_MINUTES);
  });

  it('normalizes follow zoom to allowed levels', () => {
    expect(normalizeFollowZoom(13)).toBe(13);
    expect(normalizeFollowZoom(16)).toBe(16);
    expect(normalizeFollowZoom(9)).toBe(DEFAULT_FOLLOW_ZOOM);
    expect(normalizeFollowZoom('12')).toBe(12);
  });
});
