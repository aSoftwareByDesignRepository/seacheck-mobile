import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SettingsAboutScreen } from '../screens/settings/SettingsAboutScreen';
import { SettingsAlarmsScreen } from '../screens/settings/SettingsAlarmsScreen';
import { SettingsDisplayScreen } from '../screens/settings/SettingsDisplayScreen';
import { SettingsGpsScreen } from '../screens/settings/SettingsGpsScreen';
import { SettingsHomeScreen } from '../screens/settings/SettingsHomeScreen';
import { SettingsMapScreen } from '../screens/settings/SettingsMapScreen';
import { SettingsUnitsScreen } from '../screens/settings/SettingsUnitsScreen';
import { SettingsVesselScreen } from '../screens/settings/SettingsVesselScreen';
import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  SettingsDisplay: undefined;
  SettingsMap: undefined;
  SettingsUnits: undefined;
  SettingsVessel: undefined;
  SettingsGps: undefined;
  SettingsAlarms: undefined;
  SettingsAbout: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SettingsDisplay" component={SettingsDisplayScreen} options={{ title: t('settings.menu.display') }} />
      <Stack.Screen name="SettingsMap" component={SettingsMapScreen} options={{ title: t('settings.menu.map') }} />
      <Stack.Screen name="SettingsUnits" component={SettingsUnitsScreen} options={{ title: t('settings.menu.units') }} />
      <Stack.Screen name="SettingsVessel" component={SettingsVesselScreen} options={{ title: t('settings.menu.vessel') }} />
      <Stack.Screen name="SettingsGps" component={SettingsGpsScreen} options={{ title: t('settings.menu.gps') }} />
      <Stack.Screen name="SettingsAlarms" component={SettingsAlarmsScreen} options={{ title: t('settings.menu.alarms') }} />
      <Stack.Screen name="SettingsAbout" component={SettingsAboutScreen} options={{ title: t('settings.menu.about') }} />
    </Stack.Navigator>
  );
}
