import type { ThemeMode } from '../../theme/ThemeContext';

export type ResolvedThemePalette = 'light' | 'dark' | 'redNight' | 'highContrast';

export function resolveThemePalette(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | null | undefined | 'unspecified',
): ResolvedThemePalette {
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

/** Whether chrome (StatusBar, nav) should use dark styling. */
export function resolveThemeIsDark(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | null | undefined | 'unspecified',
): boolean {
  const palette = resolveThemePalette(mode, systemScheme);
  return palette === 'dark' || palette === 'redNight' || palette === 'highContrast';
}
