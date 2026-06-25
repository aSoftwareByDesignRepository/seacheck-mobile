import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { ALL_BOTTOM_TABS, resolveBottomTabLayout, type TabName } from '../navigation/tabBarLayout';
import { navigateToTab, tabLabel, TAB_ICONS } from '../navigation/tabBarHelpers';
import { useTabOverflowStore } from '../navigation/tabOverflowStore';
import { useTheme } from '../theme/ThemeContext';

/** Side navigation rail for tablet landscape (plan §6.7). */
function NavigationRail({ state, navigation }: BottomTabBarProps) {
  const { colors, minTouch } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.rail, { backgroundColor: colors.surface, borderRightColor: colors.border, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
      testID="nav.rail"
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
        {ALL_BOTTOM_TABS.map((name) => {
          const routeIndex = state.routes.findIndex((r) => r.name === name);
          if (routeIndex < 0) return null;
          const focused = state.index === routeIndex;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tabLabel(name)}
              onPress={() => navigateToTab(name, state, navigation)}
              style={[
                styles.railItem,
                {
                  minHeight: minTouch,
                  minWidth: minTouch,
                  backgroundColor: focused ? colors.successBg : 'transparent',
                  borderColor: focused ? colors.primary : 'transparent',
                },
              ]}
              testID={`tab.${name.toLowerCase()}`}
            >
              <MaterialIcons name={TAB_ICONS[name]} size={24} color={focused ? colors.primary : colors.textMuted} />
              <Text style={[styles.railLabel, { color: focused ? colors.primary : colors.textMuted }]} numberOfLines={1}>
                {tabLabel(name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type TabButtonProps = {
  name: TabName;
  label: string;
  focused: boolean;
  showLabel: boolean;
  onPress: () => void;
  testID: string;
};

function TabButton({ name, label, focused, showLabel, onPress, testID }: TabButtonProps) {
  const { colors, minTouch } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.tabItem,
        {
          minHeight: minTouch,
          backgroundColor: focused ? colors.successBg : 'transparent',
          borderTopColor: focused ? colors.primary : 'transparent',
        },
      ]}
      testID={testID}
    >
      <MaterialIcons name={TAB_ICONS[name]} size={showLabel ? 22 : 24} color={focused ? colors.primary : colors.textMuted} />
      {showLabel ? (
        <Text
          style={[styles.tabLabel, { color: focused ? colors.primary : colors.textMuted }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MoreTabButton({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const { colors, minTouch } = useTheme();
  const { width } = useWindowDimensions();
  const showLabel = width >= 380;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused, expanded: focused }}
      accessibilityLabel={t('tabs.more')}
      accessibilityHint={t('tabs.moreHint')}
      onPress={onPress}
      style={[
        styles.tabItem,
        {
          minHeight: minTouch,
          backgroundColor: focused ? colors.successBg : 'transparent',
          borderTopColor: focused ? colors.primary : 'transparent',
        },
      ]}
      testID="tab.more"
    >
      <MaterialIcons name="more-horiz" size={showLabel ? 22 : 24} color={focused ? colors.primary : colors.textMuted} />
      {showLabel ? (
        <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textMuted }]} numberOfLines={1}>
          {t('tabs.more')}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CompactTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showLabels = width >= 380;
  const menuOpen = useTabOverflowStore((s) => s.menuOpen);
  const setMenuOpen = useTabOverflowStore((s) => s.setMenuOpen);
  const syncTabBarProps = useTabOverflowStore((s) => s.syncTabBarProps);

  const { visible, overflow } = useMemo(() => resolveBottomTabLayout(width), [width]);
  const activeName = state.routes[state.index]?.name as TabName | undefined;
  const overflowActive = activeName != null && overflow.includes(activeName);

  useEffect(() => {
    syncTabBarProps({ state, descriptors, navigation });
  }, [state, descriptors, navigation, syncTabBarProps]);

  useEffect(() => {
    if (overflow.length === 0 && menuOpen) {
      setMenuOpen(false);
    }
  }, [overflow.length, menuOpen, setMenuOpen]);

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          zIndex: 10,
          elevation: 8,
        },
      ]}
    >
      <View style={[styles.tabRow, { minHeight: minTouch }]}>
        {visible.map((name) => {
          const routeIndex = state.routes.findIndex((r) => r.name === name);
          if (routeIndex < 0) return null;
          const route = state.routes[routeIndex];
          const focused = state.index === routeIndex;
          const label = descriptors[route.key].options.title ?? tabLabel(name);
          return (
            <TabButton
              key={name}
              name={name}
              label={label}
              focused={focused}
              showLabel={showLabels}
              onPress={() => navigateToTab(name, state, navigation)}
              testID={`tab.${name.toLowerCase()}`}
            />
          );
        })}
        {overflow.length > 0 ? (
          <MoreTabButton focused={overflowActive || menuOpen} onPress={() => setMenuOpen(true)} />
        ) : null}
      </View>
    </View>
  );
}

export function AdaptiveTabBar(props: BottomTabBarProps & { variant?: 'rail' | 'bottom' }) {
  const { variant = 'bottom', ...rest } = props;
  if (variant === 'rail') return <NavigationRail {...rest} />;
  return <CompactTabBar {...rest} />;
}

const styles = StyleSheet.create({
  rail: { width: 88, borderRightWidth: 1, paddingHorizontal: 6 },
  railScroll: { gap: 4, paddingBottom: 8 },
  railItem: { borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, gap: 4 },
  railLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', alignItems: 'stretch' },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
    borderTopWidth: 3,
  },
  tabLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center', maxWidth: '100%' },
});
