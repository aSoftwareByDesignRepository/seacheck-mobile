import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: ReactNode;
  testID: string;
};

/**
 * Bottom instrument dock — flush on the tab bar, full width.
 * Safety actions live on the right map edge (MapChrome), not in the dock.
 */
export function InstrumentDockFrame({ children, testID }: Props) {
  const { colors, spacing } = useTheme();
  const bottom = useMapBottomLayout();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottom.instrumentDockBottom }]}
      testID={testID}
    >
      <View
        style={[
          styles.shell,
          {
            maxHeight: bottom.instrumentDockHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <ScrollView
          style={{ maxHeight: bottom.instrumentDockHeight }}
          contentContainerStyle={[styles.scroll, { gap: spacing.sm }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 30, elevation: 30 },
  shell: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  scroll: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, flexGrow: 0 },
});
