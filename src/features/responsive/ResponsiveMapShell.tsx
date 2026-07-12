import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { useFormFactor } from '../../hooks/useFormFactor';
import {
  resolveInstrumentPanelOnLeft,
  resolveMapSplitPanelWidth,
  shouldSplitMapLayout,
} from '../../lib/responsive/splitLayout';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { t } from '../../i18n';

type Props = {
  map: ReactNode;
  /** Instrument readouts — rendered in a side panel when split, or via overlay docks when stacked. */
  instrumentPanel?: ReactNode | null;
};

/**
 * Map host — stacked on phones; side-by-side map + instruments on tablet landscape (≥840 dp wide).
 * Overlay docks (MapInstrumentDock / MapBottomDock) render only when not split.
 */
export function ResponsiveMapShell({ map, instrumentPanel }: Props) {
  const layoutPreset = useEffectiveLayoutPreset();
  const { formFactor, isLandscape, height, width } = useFormFactor();
  const panelSide = useSettingsStore((s) => s.panelSide);
  const { spacing, colors } = useTheme();

  if (layoutPreset === 'instruments-only') {
    return null;
  }

  const split = shouldSplitMapLayout(formFactor, isLandscape, layoutPreset, height) && instrumentPanel != null;

  if (!split) {
    return <View style={styles.fill}>{map}</View>;
  }

  const panelFirst = resolveInstrumentPanelOnLeft(panelSide, isLandscape);
  const panelWidth = resolveMapSplitPanelWidth(width, layoutPreset);
  const panel = (
    <View
      accessibilityRole="summary"
      accessibilityLabel={t('map.instrumentPanelA11y')}
      style={[
        styles.instrumentPane,
        {
          width: panelWidth,
          flexGrow: 0,
          flexShrink: 0,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        panelFirst
          ? { borderRightWidth: StyleSheet.hairlineWidth, paddingRight: spacing.sm }
          : { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: spacing.sm },
      ]}
      testID="map.instrumentPanel"
    >
      {instrumentPanel}
    </View>
  );
  const mapPane = (
    <View style={styles.mapPane} testID="map.splitPane" accessibilityLabel={t('map.splitMapPaneA11y')}>
      {map}
    </View>
  );

  return (
    <View style={styles.splitRow}>
      {panelFirst ? (
        <>
          {panel}
          {mapPane}
        </>
      ) : (
        <>
          {mapPane}
          {panel}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, minWidth: 0 },
  splitRow: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
  mapPane: { flex: 1, minHeight: 0, minWidth: 0 },
  instrumentPane: {
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    paddingVertical: 4,
  },
});
