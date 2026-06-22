import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark' | 'redNight' | 'highContrast';

type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  successBg: string;
  success: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
  dangerBg: string;
  dangerBorder: string;
  danger: string;
};

const palettes: Record<'light' | 'dark' | 'redNight' | 'highContrast', ThemeColors> = {
  light: {
    background: '#f5f7fb',
    surface: '#ffffff',
    border: '#d9e2ec',
    text: '#102a43',
    textMuted: '#486581',
    primary: '#0073ad',
    primaryText: '#ffffff',
    successBg: '#e6f4ed',
    success: '#0d7a4a',
    warningBg: '#fff4e6',
    warningBorder: '#f0c987',
    warningText: '#8a4b08',
    dangerBg: '#fde8e8',
    dangerBorder: '#f5c2c2',
    danger: '#ba1b1b',
  },
  dark: {
    background: '#0b1622',
    surface: '#152536',
    border: '#2d3f52',
    text: '#f0f4f8',
    textMuted: '#bcccdc',
    primary: '#4dabf7',
    primaryText: '#0b1622',
    successBg: '#1a3d24',
    success: '#51cf66',
    warningBg: '#3d2e14',
    warningBorder: '#8a4b08',
    warningText: '#ffe8cc',
    dangerBg: '#3d1515',
    dangerBorder: '#7a2e2e',
    danger: '#ff6b6b',
  },
  redNight: {
    background: '#1a0000',
    surface: '#2a0808',
    border: '#5c2020',
    text: '#ff9999',
    textMuted: '#cc6666',
    primary: '#ff4444',
    primaryText: '#1a0000',
    successBg: '#2a1010',
    success: '#ff6666',
    warningBg: '#2a1010',
    warningBorder: '#aa4444',
    warningText: '#ffaaaa',
    dangerBg: '#3a0000',
    dangerBorder: '#ff2222',
    danger: '#ff6666',
  },
  highContrast: {
    background: '#000000',
    surface: '#000000',
    border: '#ffffff',
    text: '#ffffff',
    textMuted: '#f2f2f2',
    primary: '#ffff00',
    primaryText: '#000000',
    successBg: '#001a00',
    success: '#00ff00',
    warningBg: '#000000',
    warningBorder: '#ffff00',
    warningText: '#ffff00',
    dangerBg: '#1a0000',
    dangerBorder: '#ff0000',
    danger: '#ff4d4d',
  },
};

const STORAGE_KEY = 'seacheck.theme';

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  minTouch: number;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODES: ThemeMode[] = ['system', 'light', 'dark', 'redNight', 'highContrast'];

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw && MODES.includes(raw as ThemeMode)) {
        setModeState(raw as ThemeMode);
      }
    });
  }, []);

  const resolved =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const colors = palettes[resolved as keyof typeof palettes];

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors,
      spacing,
      minTouch: 48,
      setMode: (nextMode) => {
        setModeState(nextMode);
        void AsyncStorage.setItem(STORAGE_KEY, nextMode);
      },
    }),
    [mode, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
