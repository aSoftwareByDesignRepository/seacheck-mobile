import { StyleSheet, View } from 'react-native';

import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import type { LocationFix } from '../../services/locationService';
import { useTheme } from '../../theme/ThemeContext';
import { MapBottomDock } from './MapBottomDock';
import { MapInstrumentDock } from './MapInstrumentDock';

type Props = {
  fix: LocationFix | null;
  onOpenPassage: () => void;
};

/**
 * Side-panel instruments for split tablet landscape.
 * Uses compact dock layouts (not full-screen MapInstruments) — fits narrow panel width.
 * Lock / anchor / MOB stay on the map pane edge (MapChrome).
 */
export function MapInstrumentPanel({ fix, onOpenPassage }: Props) {
  const layoutPreset = useEffectiveLayoutPreset();
  const { colors } = useTheme();

  if (layoutPreset === 'instruments-only') {
    return null;
  }

  return (
    <View style={[styles.panel, { backgroundColor: colors.background }]} testID="map.instrumentPanelContent">
      {layoutPreset === 'minimal' ? (
        <MapBottomDock fix={fix} onOpenPassage={onOpenPassage} embedded />
      ) : (
        <MapInstrumentDock fix={fix} onOpenPassage={onOpenPassage} embedded />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, minHeight: 0, minWidth: 0 },
});
