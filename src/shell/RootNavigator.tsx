import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { rootNavigationRef } from '../navigation/rootNavigation';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainShell } from './MainShell';
import { BootGate } from './BootGate';

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  // StatusBar lives at the root so boot, onboarding, and every shell screen
  // all get readable status-bar icons (dark glyphs on light canvas and vice
  // versa). Onboarding renders outside MainShell, so a shell-local StatusBar
  // leaves its icons invisible (WCAG 1.4.11).
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <BootGate>
        {!settingsHydrated ? null : !onboardingCompleted ? (
          <OnboardingScreen />
        ) : (
          <NavigationContainer ref={rootNavigationRef} theme={navTheme}>
            <MainShell />
          </NavigationContainer>
        )}
      </BootGate>
    </>
  );
}
