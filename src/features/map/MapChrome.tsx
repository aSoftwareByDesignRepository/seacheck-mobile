import { StyleSheet, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { MapActions } from './MapActions';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
  screenLocked?: boolean;
};

/** Right-side map action stack for non-minimal layouts. */
export function MapChrome({
  showRangeRings,
  onToggleRangeRings,
  screenLocked = false,
}: Props) {
  const { minTouch } = useTheme();
  const layout = useMapBottomLayout({ showSideActions: true });

  if (screenLocked) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.actions,
        {
          bottom: layout.actionsBottom,
          right: layout.right,
          minHeight: minTouch,
        },
      ]}
      testID="map.actionsColumn"
    >
      <MapActions showRangeRings={showRangeRings} onToggleRangeRings={onToggleRangeRings} inline />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { position: 'absolute', zIndex: 40 },
});
