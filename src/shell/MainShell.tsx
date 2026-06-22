import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { MapScreen } from '../screens/MapScreen';
import { PassageScreen } from '../screens/PassageScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TracksScreen } from '../screens/TracksScreen';
import { WaypointsScreen } from '../screens/WaypointsScreen';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<RootTabParamList>();

function tabIcon(name: keyof RootTabParamList, color: string, size: number) {
  const icons: Record<keyof RootTabParamList, keyof typeof MaterialIcons.glyphMap> = {
    Map: 'map',
    Passage: 'route',
    Waypoints: 'place',
    Tracks: 'timeline',
    Downloads: 'download',
    Settings: 'settings',
  };
  return <MaterialIcons name={icons[name]} color={color} size={size} />;
}

function tabLabel(name: keyof RootTabParamList): string {
  return t(`tabs.${name.toLowerCase()}` as 'tabs.map');
}

export function MainShell() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === 'dark' || mode === 'redNight' || mode === 'highContrast';

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => tabIcon(route.name, color, size),
          tabBarAccessibilityLabel: tabLabel(route.name),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
            height: 56 + Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        })}
      >
        <Tab.Screen name="Map" component={MapScreen} options={{ title: t('tabs.map'), tabBarButtonTestID: 'tab.map' }} />
        <Tab.Screen name="Passage" component={PassageScreen} options={{ title: t('tabs.passage'), tabBarButtonTestID: 'tab.passage' }} />
        <Tab.Screen name="Waypoints" component={WaypointsScreen} options={{ title: t('tabs.waypoints'), tabBarButtonTestID: 'tab.waypoints' }} />
        <Tab.Screen name="Tracks" component={TracksScreen} options={{ title: t('tabs.tracks'), tabBarButtonTestID: 'tab.tracks' }} />
        <Tab.Screen name="Downloads" component={DownloadsScreen} options={{ title: t('tabs.downloads'), tabBarButtonTestID: 'tab.downloads' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('tabs.settings'), tabBarButtonTestID: 'tab.settings' }} />
      </Tab.Navigator>
    </>
  );
}
