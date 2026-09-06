import {
  bootWarningsIncludeCritical,
  canDismissBootWarnings,
  isCriticalBootWarning,
} from '../src/shell/bootWarningPolicy';

describe('bootWarningPolicy — charts honesty', () => {
  it('treats offline as critical (non-dismissible)', () => {
    expect(isCriticalBootWarning('offline')).toBe(true);
    expect(bootWarningsIncludeCritical(['waypoints', 'offline'])).toBe(true);
    expect(canDismissBootWarnings(['offline'])).toBe(false);
    expect(canDismissBootWarnings(['offline', 'tracks'])).toBe(false);
  });

  it('allows dismiss only when offline is absent', () => {
    expect(canDismissBootWarnings(['waypoints'])).toBe(true);
    expect(canDismissBootWarnings(['tracks', 'navigation'])).toBe(true);
    expect(canDismissBootWarnings([])).toBe(false);
  });
});
