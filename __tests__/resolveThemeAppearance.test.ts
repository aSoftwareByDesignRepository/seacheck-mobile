import { resolveThemeIsDark, resolveThemePalette } from '../src/lib/theme/resolveThemeAppearance';

describe('resolveThemeAppearance', () => {
  it('follows OS scheme when mode is system', () => {
    expect(resolveThemePalette('system', 'dark')).toBe('dark');
    expect(resolveThemePalette('system', 'light')).toBe('light');
    expect(resolveThemeIsDark('system', 'dark')).toBe(true);
    expect(resolveThemeIsDark('system', 'light')).toBe(false);
  });

  it('treats red night and high contrast as dark chrome', () => {
    expect(resolveThemeIsDark('redNight', 'light')).toBe(true);
    expect(resolveThemeIsDark('highContrast', 'light')).toBe(true);
    expect(resolveThemeIsDark('light', 'dark')).toBe(false);
  });
});
