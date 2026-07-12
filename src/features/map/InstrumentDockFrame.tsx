import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  children: ReactNode;
  testID: string;
  /** overlay = absolute bottom dock; embedded = flex child in split side panel. */
  mode?: 'overlay' | 'embedded';
};

/**
 * Bottom instrument dock — flush on the tab bar, full width.
 * Safety actions live on the right map edge (MapChrome), not in the dock.
 */
export function InstrumentDockFrame({ children, testID, mode = 'overlay' }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const bottom = useMapBottomLayout();

  const shell = (
    <View
      style={[
        styles.shell,
        mode === 'embedded' ? styles.embeddedShell : null,
        {
          maxHeight: mode === 'embedded' ? undefined : bottom.instrumentDockHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      <ScrollView
        style={mode === 'embedded' ? styles.embeddedScroll : { maxHeight: bottom.instrumentDockHeight }}
        contentContainerStyle={[styles.scroll, { gap: spacing.sm, minHeight: minTouch }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={mode === 'embedded'}
        bounces={mode === 'embedded'}
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    </View>
  );

  if (mode === 'embedded') {
    return (
      <View style={styles.embeddedHost} testID={testID}>
        {shell}
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottom.instrumentDockBottom }]}
      testID={testID}
    >
      {shell}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 30, elevation: 30 },
  embeddedHost: { flex: 1, minHeight: 0, minWidth: 0 },
  shell: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  embeddedShell: { flex: 1, minHeight: 0, borderTopWidth: 0 },
  embeddedScroll: { flex: 1, minHeight: 0 },
  scroll: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, flexGrow: 0 },
});
