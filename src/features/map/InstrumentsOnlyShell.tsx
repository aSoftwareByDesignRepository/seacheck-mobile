import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { t } from '../../i18n';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import type { LocationFix } from '../../services/locationService';
import { useTheme } from '../../theme/ThemeContext';
import { MapChrome } from './MapChrome';
import { MapInstruments } from './MapInstruments';

type Props = {
  fix: LocationFix | null;
  topChrome: ReactNode;
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
  screenLocked?: boolean;
};

/** Full-screen instruments without a chart — GPS, anchor, MOB, and tools stay available. */
export function InstrumentsOnlyShell({
  fix,
  topChrome,
  showRangeRings,
  onToggleRangeRings,
  screenLocked = false,
}: Props) {
  const { colors, spacing } = useTheme();
  const layout = useMapBottomLayout({ showSideActions: !screenLocked });

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.background }]}
      accessibilityRole="summary"
      accessibilityLabel={t('map.instrumentsOnlyA11y')}
      testID="map.instrumentsOnly"
    >
      <View
        style={{
          paddingTop: layout.top,
          paddingLeft: layout.left,
          paddingRight: layout.right,
          paddingBottom: spacing.xs,
        }}
        pointerEvents="box-none"
      >
        {topChrome}
      </View>
      <View style={styles.panelRegion}>
        <MapInstruments fix={fix} fullScreen />
      </View>
      {!screenLocked ? (
        <MapChrome showRangeRings={showRangeRings} onToggleRangeRings={onToggleRangeRings} screenLocked={screenLocked} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  panelRegion: { flex: 1, minHeight: 0 },
});
