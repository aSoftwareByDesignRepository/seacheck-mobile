import type { CourseVectorVisualScale } from './mapSettings';

/** i18n key for a course-vector visual scale chip label. */
export function courseVectorScaleLabelKey(scale: CourseVectorVisualScale): string {
  switch (scale) {
    case 'standard':
      return 'settings.courseVectorScaleStandard';
    case 'long':
      return 'settings.courseVectorScaleLong';
    case 'extra':
      return 'settings.courseVectorScaleExtra';
  }
}
