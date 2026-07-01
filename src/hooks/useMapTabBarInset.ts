import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarOccupiedHeight, usesBottomTabBar } from '../lib/navigation/tabBarGeometry';
import { useTheme } from '../theme/ThemeContext';
import { useFormFactor } from './useFormFactor';

/** Bottom inset to keep map chrome above the tab bar (or safe area on tablet rail). */
export function useMapTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const { minTouch, spacing } = useTheme();
  const { formFactor, isLandscape } = useFormFactor();

  return useMemo(() => {
    if (!usesBottomTabBar(formFactor, isLandscape)) {
      return Math.max(insets.bottom, spacing.sm);
    }
    return tabBarOccupiedHeight(insets.bottom, minTouch);
  }, [formFactor, isLandscape, insets.bottom, minTouch, spacing.sm]);
}
