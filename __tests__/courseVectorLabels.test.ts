import { courseVectorScaleLabelKey } from '../src/lib/settings/courseVectorLabels';

describe('courseVectorScaleLabelKey', () => {
  it('maps each scale to an i18n key', () => {
    expect(courseVectorScaleLabelKey('standard')).toBe('settings.courseVectorScaleStandard');
    expect(courseVectorScaleLabelKey('long')).toBe('settings.courseVectorScaleLong');
    expect(courseVectorScaleLabelKey('extra')).toBe('settings.courseVectorScaleExtra');
  });
});
