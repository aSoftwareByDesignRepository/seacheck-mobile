import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { t } from '../../i18n';
import type { LocationFix } from '../../services/locationService';
import { useTheme } from '../../theme/ThemeContext';
import { MapInstruments } from './MapInstruments';

type Props = {
  fix: LocationFix | null;
  /** Top map chrome (GPS strip, banners) rendered above the instruments. */
  topChrome?: ReactNode;
  screenLocked?: boolean;
  onOpenPassage: () => void;
};

/** Full-screen instruments — safety actions overlay via MapChrome (same as map layouts). */
export function InstrumentsOnlyShell({
  fix,
  topChrome,
  screenLocked = false,
  onOpenPassage,
}: Props) {
  const { colors, spacing } = useTheme();
  const layout = useMapBottomLayout({ showSideActions: false });

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.background }]}
      accessibilityRole="summary"
      accessibilityLabel={t('map.instrumentsOnlyA11y')}
      testID="map.instrumentsOnly"
    >
      {topChrome ? (
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
      ) : null}
      <View style={styles.panelRegion}>
        {!screenLocked ? (
          <MapInstruments fix={fix} onOpenPassage={onOpenPassage} />
        ) : (
          <View style={styles.lockedPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  panelRegion: { flex: 1, minHeight: 0 },
  lockedPlaceholder: { flex: 1 },
});
