import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { t } from '../i18n';
import { BottomSheet } from '../ui/BottomSheet';
import { SheetMenuRow } from '../ui/SheetSection';
import { navigateToTab, tabLabel, TAB_ICONS } from './tabBarHelpers';
import { resolveBottomTabLayout, type TabName } from './tabBarLayout';
import { useTabOverflowStore } from './tabOverflowStore';

/** Overflow tab destinations — rendered outside the tab bar so the sheet host stays stable. */
export function TabOverflowMenu() {
  const menuOpen = useTabOverflowStore((s) => s.menuOpen);
  const setMenuOpen = useTabOverflowStore((s) => s.setMenuOpen);
  const tabBarProps = useTabOverflowStore((s) => s.tabBarProps);
  const { width } = useWindowDimensions();

  const overflow = useMemo(() => resolveBottomTabLayout(width).overflow, [width]);

  useEffect(() => {
    if (overflow.length === 0 && menuOpen) {
      setMenuOpen(false);
    }
  }, [overflow.length, menuOpen, setMenuOpen]);

  if (!tabBarProps || overflow.length === 0) return null;

  const { state, descriptors, navigation } = tabBarProps;
  const activeName = state.routes[state.index]?.name as TabName | undefined;

  function closeMenu() {
    setMenuOpen(false);
  }

  function selectOverflowTab(name: TabName) {
    navigateToTab(name, state, navigation);
    closeMenu();
  }

  return (
    <BottomSheet visible={menuOpen} onClose={closeMenu} title={t('tabs.moreMenuTitle')} testID="tab.more.sheet">
      <View style={{ gap: 8 }}>
        {overflow.map((name) => {
          const routeIndex = state.routes.findIndex((r) => r.name === name);
          if (routeIndex < 0) return null;
          const focused = state.index === routeIndex;
          const route = state.routes[routeIndex];
          const label = descriptors[route.key].options.title ?? tabLabel(name);
          return (
            <SheetMenuRow
              key={name}
              label={label}
              icon={TAB_ICONS[name]}
              selected={focused}
              onPress={() => selectOverflowTab(name)}
              testID={`tab.${name.toLowerCase()}`}
            />
          );
        })}
      </View>
    </BottomSheet>
  );
}
