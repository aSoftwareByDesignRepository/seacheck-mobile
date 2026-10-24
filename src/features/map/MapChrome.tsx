import { StyleSheet, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { useSafetyActionsMetrics } from '../../hooks/useSafetyActionsMetrics';
import { MapActions } from './MapActions';
import { safetyActionButtonCount } from './mapSafetyActionsLayout';

type Props = {
  onMobDropped?: () => void;
  showAnchor?: boolean;
  screenLocked?: boolean;
};

/** Right-side safety stack — lock, anchor, MOB — above bottom chrome when present. */
export function MapChrome({ onMobDropped, showAnchor = true, screenLocked = false }: Props) {
  const layout = useMapBottomLayout({
    showSideActions: true,
    safetyButtonCount: safetyActionButtonCount(showAnchor),
  });
  const variant = layout.safetyArrangement === 'row' ? 'row' : 'side';
  const metrics = useSafetyActionsMetrics(variant, showAnchor);

  if (screenLocked) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.actions,
        {
          bottom: layout.actionsColumnBottom,
          right: layout.right,
          minHeight: metrics.buttonSize,
        },
      ]}
      testID="map.actionsColumn"
    >
      <MapActions variant={variant} onMobDropped={onMobDropped} showAnchor={showAnchor} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { position: 'absolute', zIndex: 40, elevation: 40 },
});
