import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalDownloadSessionChrome } from '../features/downloads/GlobalDownloadSessionChrome';
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
import { useExclusiveChartDownloadSession } from '../hooks/useExclusiveChartDownloadSession';
import { useFormFactor } from '../hooks/useFormFactor';
import { t } from '../i18n';
import { navigateToMapForChartDownload } from '../navigation/rootNavigation';
import type { RootTabParamList } from '../navigation/types';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { MapScreen } from '../screens/MapScreen';
import { PassageStack } from '../navigation/PassageStack';
import { SettingsStack } from '../navigation/SettingsStack';
import { TracksScreen } from '../screens/TracksScreen';
import { useFeedbackStore } from '../store/feedbackStore';
import { useNavigationStore } from '../store/navigationStore';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<RootTabParamList>();

const DOWNLOAD_SAFE_TABS = new Set<keyof RootTabParamList>(['Map', 'Downloads']);

/**
 * Active root tab — tracked via Tab.Navigator `screenListeners.state`.
 * Do NOT call `useNavigationState` here: MainShell *hosts* the navigator and is
 * not inside it (throws "Couldn't get the navigation state").
 */
export function MainShell() {
  const { colors, isDark } = useTheme();
  useResumeBackgroundSync();
  useAppLocationWatch();
  useDownloadKeepAwake();
  useDownloadFailureAlerts();
  useMaritimeMonitors();
  useForegroundTrackRecording();
  const exclusiveChartDownload = useExclusiveChartDownloadSession();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const { formFactor, isLandscape } = useFormFactor();
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);
  const { useRail, tabBarPosition } = resolveShellTabBarLayout(formFactor, isLandscape);
  const [activeTab, setActiveTab] = useState<keyof RootTabParamList>('Map');
  /**
   * Global cancel on non-Map tabs. On Map, VisibleDownloadMapPane owns cancel —
   * an absolute overlay here can block Android TextureView paint (DOWNLOAD_MAP_NOT_READY).
   */
  const showGlobalDownloadChrome = exclusiveChartDownload && activeTab !== 'Map';

  // Keep the sticky download GL surface on the Map tab (Android TextureView must paint).
  useEffect(() => {
    if (!exclusiveChartDownload) return;
    if (activeTab === 'Map') return;
    navigateToMapForChartDownload();
  }, [exclusiveChartDownload, activeTab]);

  const onTabNavigatorState = useCallback(
    (e: { data: { state?: { index: number; routes: { name: string }[] } } }) => {
      const navState = e.data.state;
      if (!navState?.routes?.length) return;
      const route = navState.routes[navState.index];
      if (route?.name) setActiveTab(route.name as keyof RootTabParamList);
    },
    [],
  );

  const guardDownloadTabPress = useCallback(
    (tab: keyof RootTabParamList) =>
      ({
        tabPress: (e: { preventDefault: () => void }) => {
          if (!exclusiveChartDownload) return;
          if (DOWNLOAD_SAFE_TABS.has(tab)) return;
          e.preventDefault();
          showInfo(t('downloads.stayOnMapWhileSaving'));
        },
      }) as const,
    [exclusiveChartDownload, showInfo],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenLockCoordinator />
      <Tab.Navigator
        tabBar={(props) => <AdaptiveTabBar {...props} variant={useRail ? 'rail' : 'bottom'} />}
        detachInactiveScreens={false}
        screenListeners={{ state: onTabNavigatorState }}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: false,
          sceneStyle: [styles.scene, { backgroundColor: colors.background }],
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
          options={{ title: t('tabs.map'), tabBarButtonTestID: 'tab.map' }}
          listeners={guardDownloadTabPress('Map')}
        />
        <Tab.Screen
          name="Passage"
          component={PassageStack}
          options={{ title: t('tabs.passage'), tabBarButtonTestID: 'tab.passage' }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              if (exclusiveChartDownload) {
                e.preventDefault();
                showInfo(t('downloads.stayOnMapWhileSaving'));
                return;
              }
              // Always land on the passage overview list, even when a detail page
              // is still on the nested stack from a previous visit or map hand-off.
              e.preventDefault();
              navigation.navigate('Passage', { screen: 'PassageList' });
            },
          })}
        />
        <Tab.Screen
          name="Tracks"
          component={TracksScreen}
          options={{ title: t('tabs.tracks'), tabBarButtonTestID: 'tab.tracks' }}
          listeners={guardDownloadTabPress('Tracks')}
        />
        <Tab.Screen
          name="Downloads"
          component={DownloadsScreen}
          options={{ title: t('tabs.downloads'), tabBarButtonTestID: 'tab.downloads' }}
          listeners={guardDownloadTabPress('Downloads')}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStack}
          options={{ title: t('tabs.settings'), tabBarButtonTestID: 'tab.settings' }}
          listeners={guardDownloadTabPress('Settings')}
        />
      </Tab.Navigator>
      <TabOverflowMenu />
      {showGlobalDownloadChrome ? <GlobalDownloadSessionChrome /> : null}
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
