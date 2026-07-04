import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: ReactNode;
  minHeight: number;
  testID?: string;
};

/** Shared layout for map status chip rows — wrap instead of clip or horizontal scroll. */
export function mapStatusChipRowStyle(gap: number, minHeight: number, paddingVertical: number): ViewStyle {
  return {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'flex-start',
    gap,
    paddingVertical,
    minHeight,
  };
}

/**
 * Map status chips — each chip is a direct child (no nested flex rows).
 * Wraps to the next line when labels exceed width (long i18n, many alerts).
 */
export function MapStatusChipRow({ children, minHeight, testID }: Props) {
  const { spacing } = useTheme();

  return (
    <View
      style={mapStatusChipRowStyle(spacing.sm, minHeight, spacing.xs)}
      testID={testID}
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </View>
  );
}
