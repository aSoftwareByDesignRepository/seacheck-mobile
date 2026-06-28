import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';

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

  return (
    <BootGate>
      {!settingsHydrated ? null : !onboardingCompleted ? (
        <OnboardingScreen />
      ) : (
        <NavigationContainer theme={navTheme}>
          <MainShell />
        </NavigationContainer>
      )}
    </BootGate>
  );
}
