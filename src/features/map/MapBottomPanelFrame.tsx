import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { mapBottomPanelReserve } from './mapChromeLayout';

type Props = {
  children: ReactNode;
  /** Max height for scrollable panel body. */
  maxContentHeight: number;
  testID: string;
  /** Highlight top edge (e.g. passage planning mode). */
  accentTop?: boolean;
  zIndex?: number;
};

/**
 * Full-width bottom map panel — flush on the tab bar.
 * Safety actions stay on the right map edge (MapChrome).
 */
export function MapBottomPanelFrame({
  children,
  maxContentHeight,
  testID,
  accentTop = false,
  zIndex = 55,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const panelMaxHeight = mapBottomPanelReserve(maxContentHeight);

  return (
    <View pointerEvents="box-none" style={[styles.host, { zIndex, elevation: zIndex }]} testID={testID}>
      <View
        style={[
          styles.shell,
          {
            maxHeight: panelMaxHeight,
            backgroundColor: colors.background,
            borderTopColor: accentTop ? colors.primary : colors.border,
          },
        ]}
      >
        <ScrollView
          style={{ maxHeight: maxContentHeight }}
          contentContainerStyle={[styles.scroll, { gap: spacing.sm, padding: spacing.md, minHeight: minTouch }]}
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
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  shell: { borderTopWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  scroll: { flexGrow: 0 },
});
