import { CRUISE_PASSAGE_DEFAULTS } from '../src/settings/defaults';

describe('CRUISE_PASSAGE_DEFAULTS', () => {
  it('locks cruise/passage as first-run defaults', () => {
    expect(CRUISE_PASSAGE_DEFAULTS).toMatchObject({
      activityProfileId: 'cruise-passage',
      sogUnit: 'kn',
      distanceUnit: 'nm',
      bearingReference: 'true',
      coordFormat: 'ddm',
      mapCourseUp: true,
      followMode: true,
      keepAwakeUnderway: true,
    });
  });
});
