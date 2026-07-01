import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: ReactNode;
  /** Horizontal space reserved on the right (e.g. safety action column). */
  reserveRight?: number;
  minHeight: number;
  testID?: string;
};

/**
 * Single-row status chips — scrolls horizontally when content exceeds width.
 * Reserves right inset so chips never sit under the side safety stack.
 */
export function MapChipScrollRow({ children, reserveRight = 0, minHeight, testID }: Props) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.host, { minHeight }]} testID={testID}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { gap: spacing.sm, paddingVertical: spacing.xs, minHeight, alignItems: 'center' },
        ]}
      >
        {children}
      </ScrollView>
      {reserveRight > 0 ? <View style={{ width: reserveRight, flexShrink: 0 }} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  scroll: { flex: 1, minWidth: 0, flexGrow: 1, flexShrink: 1 },
  content: { flexDirection: 'row', flexWrap: 'nowrap' },
});
