import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { ScreenLockOverlay } from '../features/map/ScreenLockOverlay';
import { ScreenLockCoordinator } from '../features/map/ScreenLockCoordinator';
import { AdaptiveTabBar } from '../navigation/AdaptiveTabBar';
import { resolveShellTabBarLayout } from '../lib/navigation/shellLayoutPolicy';
import { TabOverflowMenu } from '../navigation/TabOverflowMenu';
import { useResumeBackgroundSync } from '../hooks/useResumeBackgroundSync';
import { useDownloadFailureAlerts } from '../hooks/useDownloadFailureAlerts';
import { useDownloadKeepAwake } from '../hooks/useDownloadKeepAwake';
import { useAppLocationWatch } from '../hooks/useAppLocationWatch';
import { useMaritimeMonitors } from '../hooks/useMaritimeMonitors';
import { useForegroundTrackRecording } from '../hooks/useForegroundTrackRecording';
import { useFormFactor } from '../hooks/useFormFactor';
import { t } from '../i18n';
import type { RootTabParamList } from '../navigation/types';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { MapScreen } from '../screens/MapScreen';
import { PassageStack } from '../navigation/PassageStack';
import { SettingsStack } from '../navigation/SettingsStack';
import { TracksScreen } from '../screens/TracksScreen';
import { useNavigationStore } from '../store/navigationStore';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function MainShell() {
  const { colors, isDark } = useTheme();
  useResumeBackgroundSync();
  useAppLocationWatch();
  useDownloadKeepAwake();
  useDownloadFailureAlerts();
  useMaritimeMonitors();
  useForegroundTrackRecording();
  const { formFactor, isLandscape } = useFormFactor();
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);
  const { useRail, tabBarPosition } = resolveShellTabBarLayout(formFactor, isLandscape);

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenLockCoordinator />
      <Tab.Navigator
        tabBar={(props) => <AdaptiveTabBar {...props} variant={useRail ? 'rail' : 'bottom'} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: styles.scene,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarPosition,
          tabBarStyle: useRail
            ? {
                borderTopWidth: 0,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: colors.border,
                backgroundColor: colors.surface,
                elevation: 0,
              }
            : {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
        }}
      >
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ title: t('tabs.map'), tabBarButtonTestID: 'tab.map', lazy: false }}
        />
        <Tab.Screen
          name="Passage"
          component={PassageStack}
          options={{ title: t('tabs.passage'), tabBarButtonTestID: 'tab.passage' }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Always land on the passage overview list, even when a detail page
              // is still on the nested stack from a previous visit or map hand-off.
              e.preventDefault();
              navigation.navigate('Passage', { screen: 'PassageList' });
            },
          })}
        />
        <Tab.Screen name="Tracks" component={TracksScreen} options={{ title: t('tabs.tracks'), tabBarButtonTestID: 'tab.tracks' }} />
        <Tab.Screen name="Downloads" component={DownloadsScreen} options={{ title: t('tabs.downloads'), tabBarButtonTestID: 'tab.downloads' }} />
        <Tab.Screen name="Settings" component={SettingsStack} options={{ title: t('tabs.settings'), tabBarButtonTestID: 'tab.settings' }} />
      </Tab.Navigator>
      <TabOverflowMenu />
      {screenLocked ? (
        <ScreenLockOverlay visible={screenLocked} onUnlock={() => void setScreenLocked(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scene: { flex: 1 },
});
