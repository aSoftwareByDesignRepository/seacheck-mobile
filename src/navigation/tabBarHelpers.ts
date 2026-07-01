import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';

import { t } from '../i18n';
import type { TabName } from './tabBarLayout';

export const TAB_ICONS: Record<TabName, keyof typeof MaterialIcons.glyphMap> = {
  Map: 'map',
  Passage: 'route',
  Tracks: 'timeline',
  Downloads: 'download',
  Settings: 'settings',
};

export function tabLabel(name: TabName): string {
  return t(`tabs.${name.toLowerCase()}` as 'tabs.map');
}

export function navigateToTab(
  name: TabName,
  state: BottomTabBarProps['state'],
  navigation: BottomTabBarProps['navigation'],
): void {
  const routeIndex = state.routes.findIndex((r) => r.name === name);
  if (routeIndex < 0) return;
  const route = state.routes[routeIndex];
  const focused = state.index === routeIndex;
  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (!focused && !event.defaultPrevented) {
    navigation.dispatch({
      ...CommonActions.navigate(route.name, route.params),
      target: state.key,
    });
  }
}
