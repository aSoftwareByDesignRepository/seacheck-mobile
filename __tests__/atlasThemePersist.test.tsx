/**
 * ATLAS 3.5.14 durable proof: theme mode ('seacheck.theme' AsyncStorage key)
 * write → persist → remount-reload. The jest AsyncStorage mock is a real
 * Map-backed store, so this exercises the genuine persist path — not a stub.
 */
import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';

import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

const THEME_KEY = 'seacheck.theme';

function ModeProbe({ setTo }: { setTo?: 'light' | 'dark' | 'redNight' | 'highContrast' | 'system' }) {
  const { mode, setMode } = useTheme();
  useEffect(() => {
    if (setTo) setMode(setTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Text testID="mode">{mode}</Text>;
}

describe('theme mode persist round-trip', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(THEME_KEY);
  });

  it('setMode writes the key; a fresh provider remount restores it', async () => {
    const first = render(
      <ThemeProvider>
        <ModeProbe setTo="highContrast" />
      </ThemeProvider>,
    );
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(THEME_KEY)).toBe('highContrast');
    });
    first.unmount();

    const second = render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(second.getByTestId('mode').props.children).toBe('highContrast');
    });
    second.unmount();
  });

  it('corrupt stored value falls back to system on reload (invalid)', async () => {
    await AsyncStorage.setItem(THEME_KEY, 'neon-unicorn');
    const tree = render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(tree.getByTestId('mode').props.children).toBe('system');
    });
    tree.unmount();
  });

  it('every shipping mode persists byte-exact', async () => {
    for (const m of ['light', 'dark', 'redNight', 'highContrast', 'system'] as const) {
      await AsyncStorage.removeItem(THEME_KEY);
      const tree = render(
        <ThemeProvider>
          <ModeProbe setTo={m} />
        </ThemeProvider>,
      );
      await waitFor(async () => {
        expect(await AsyncStorage.getItem(THEME_KEY)).toBe(m);
      });
      tree.unmount();
    }
  });
});
