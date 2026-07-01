import { Platform } from 'react-native';

import { filterChipStyle, statusBadgeMinHeight, statusBadgeStyle, touchChipStyle } from '../src/ui/chipTokens';

describe('chipTokens', () => {
  it('touch chips meet minimum WCAG touch height without extra vertical padding', () => {
    const chip = touchChipStyle(48);
    expect(chip.minHeight).toBe(48);
    expect(chip.paddingVertical).toBeUndefined();
    expect(chip.justifyContent).toBe('center');
  });

  it('filter chips reuse touch chip sizing', () => {
    const chip = filterChipStyle(56);
    expect(chip.minHeight).toBe(56);
    expect(chip.borderRadius).toBe(999);
  });

  it('status badges have readable line height', () => {
    const badge = statusBadgeStyle();
    expect(badge.paddingVertical).toBeGreaterThanOrEqual(6);
    expect(badge.justifyContent).toBe('center');
    expect(statusBadgeMinHeight()).toBeGreaterThanOrEqual(28);
  });

  it('uses Android font padding fix on chip text styles', () => {
    if (Platform.OS === 'android') {
      const { touchChipText, filterChipText, statusBadgeText } = require('../src/ui/chipTokens');
      expect(touchChipText.includeFontPadding).toBe(false);
      expect(filterChipText.includeFontPadding).toBe(false);
      expect(statusBadgeText.includeFontPadding).toBe(false);
    }
  });
});
