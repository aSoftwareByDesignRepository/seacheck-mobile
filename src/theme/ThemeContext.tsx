import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';
import { resolveThemeIsDark, resolveThemePalette } from '../lib/theme/resolveThemeAppearance';
import { BRAND } from './brandColors';

export type ThemeMode = 'system' | 'light' | 'dark' | 'redNight' | 'highContrast';

export type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryText: string;
  successBg: string;
  successBorder: string;
  success: string;
  /** Soft idle / informational status well (DS §5 — not outline-on-surface). */
  neutralBg: string;
  neutralBorder: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
  dangerBg: string;
  dangerBorder: string;
  danger: string;
  dangerText: string;
  trafficGreen: string;
  trafficYellow: string;
  trafficRed: string;
  overlay: string;
};

/**
 * Check-family canvas tokens — COMPANION-DESIGN-SYSTEM §2/§3/§7.
 * Map chart paints stay in brandColors / mapChartColors (content, not chrome).
 * redNight is an opt-in maritime night-vision mode (not default chrome dialect).
 */
export const lightPalette: ThemeColors = {
  background: '#f5f7fb',
  surface: '#ffffff',
  border: '#d9e2ec',
  text: '#102a43',
  textMuted: '#486581',
  textSubtle: '#56697d',
  primary: BRAND.primary,
  primaryText: BRAND.onPrimary,
  successBg: '#e6f4ed',
  successBorder: '#9fd4b8',
  success: BRAND.success,
  neutralBg: '#e8eef5',
  neutralBorder: '#c5d4e3',
  warningBg: '#fff4e6',
  warningBorder: '#f0c987',
  warningText: '#8a4b08',
  dangerBg: '#fde8e8',
  dangerBorder: '#f5c2c2',
  danger: BRAND.dangerStrong,
  dangerText: '#ffffff',
  trafficGreen: '#0d7a4a',
  trafficYellow: '#8a4b08',
  trafficRed: '#ba1b1b',
  overlay: 'rgba(16, 42, 67, 0.45)',
};

export const darkPalette: ThemeColors = {
  background: '#0b1622',
  surface: '#152536',
  border: '#2d3f52',
  text: '#f0f4f8',
  textMuted: '#bcccdc',
  textSubtle: '#9fb3c8',
  primary: '#4dabf7',
  primaryText: '#0b1622',
  successBg: '#1a3d24',
  successBorder: '#2f6b42',
  success: '#51cf66',
  neutralBg: '#1a2838',
  neutralBorder: '#3d5166',
  warningBg: '#3d2e14',
  warningBorder: '#8a4b08',
  warningText: '#ffe8cc',
  dangerBg: '#3d1515',
  dangerBorder: '#7a2e2e',
  danger: '#c62828',
  dangerText: '#ffffff',
  trafficGreen: '#51cf66',
  trafficYellow: '#ffd43b',
  trafficRed: '#ff6b6b',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

/** Maritime red-night vision — opt-in mode; not default Check chrome. */
export const redNightPalette: ThemeColors = {
  background: '#1a0000',
  surface: '#2a0808',
  border: '#5c2020',
  text: '#ff9999',
  textMuted: '#cc6666',
  textSubtle: '#bb5555',
  primary: '#ff4444',
  primaryText: '#1a0000',
  successBg: '#2a1010',
  successBorder: '#aa4444',
  success: '#ff6666',
  neutralBg: '#2a1010',
  neutralBorder: '#5c2020',
  warningBg: '#2a1010',
  warningBorder: '#aa4444',
  warningText: '#ffaaaa',
  dangerBg: '#3a0000',
  dangerBorder: '#ff2222',
  danger: '#ff6666',
  dangerText: '#1a0000',
  trafficGreen: '#ff6666',
  trafficYellow: '#ffaaaa',
  trafficRed: '#ff2222',
  overlay: 'rgba(26, 0, 0, 0.7)',
};

export const highContrastPalette: ThemeColors = {
  background: '#000000',
  surface: '#000000',
  border: '#ffffff',
  text: '#ffffff',
  textMuted: '#f2f2f2',
  textSubtle: '#e0e0e0',
  primary: '#ffff00',
  primaryText: '#000000',
  successBg: '#001a00',
  successBorder: '#00ff00',
  success: '#00ff00',
  neutralBg: '#000000',
  neutralBorder: '#ffffff',
  warningBg: '#000000',
  warningBorder: '#ffff00',
  warningText: '#ffff00',
  dangerBg: '#1a0000',
  dangerBorder: '#ff6666',
  danger: '#ff6666',
  dangerText: '#000000',
  trafficGreen: '#00ff00',
  trafficYellow: '#ffff00',
  trafficRed: '#ff6666',
  overlay: 'rgba(0, 0, 0, 0.85)',
};

const palettes: Record<'light' | 'dark' | 'redNight' | 'highContrast', ThemeColors> = {
  light: lightPalette,
  dark: darkPalette,
  redNight: redNightPalette,
  highContrast: highContrastPalette,
};

const STORAGE_KEY = 'seacheck.theme';

export const themeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

type ThemeContextValue = {
  mode: ThemeMode;
  /** Resolved dark appearance — includes system mode following OS scheme. */
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof themeSpacing;
  minTouch: number;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODES: ThemeMode[] = ['system', 'light', 'dark', 'redNight', 'highContrast'];

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const gloveMode = useSettingsStore((s) => s.gloveMode);
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw && MODES.includes(raw as ThemeMode)) {
        setModeState(raw as ThemeMode);
      }
    });
  }, []);

  const resolved = resolveThemePalette(mode, systemScheme);
  const isDark = resolveThemeIsDark(mode, systemScheme);
  const colors = palettes[resolved];

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors,
      spacing: themeSpacing,
      minTouch: gloveMode ? 56 : 48,
      setMode: (nextMode) => {
        setModeState(nextMode);
        void AsyncStorage.setItem(STORAGE_KEY, nextMode);
      },
    }),
    [mode, isDark, colors, gloveMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
