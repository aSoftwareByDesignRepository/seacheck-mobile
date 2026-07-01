import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { statusBadgeMinHeight } from './chipTokens';
import { StatusBadge } from './StatusBadge';

type Variant = 'success' | 'warning' | 'danger' | 'neutral';

type BadgeItem = {
  key: string;
  label: string;
  variant?: Variant;
};

type Props = {
  items: BadgeItem[];
  testID?: string;
};

/**
 * Status badges — wrap to the next line when labels exceed width (long i18n strings).
 */
export function StatusBadgeRow({ items, testID }: Props) {
  const { spacing } = useTheme();

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.host, { gap: spacing.xs, minHeight: statusBadgeMinHeight() }]}
      testID={testID}
    >
      {items.map((item) => (
        <StatusBadge key={item.key} label={item.label} variant={item.variant} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
});

export type { BadgeItem, Variant };

export function compactBadgeItems(items: (BadgeItem | null | undefined)[]): BadgeItem[] {
  return items.filter((item): item is BadgeItem => item != null);
}
