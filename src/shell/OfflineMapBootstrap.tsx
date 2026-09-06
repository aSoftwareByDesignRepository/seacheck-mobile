import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';

import { DownloadMapSessionHost } from '../features/downloads/DownloadMapSessionHost';
import { OfflineMapEngineHost } from '../features/offline/OfflineMapEngineHost';
import { useMapLibreNetworkSync } from '../hooks/useMapLibreNetworkSync';
import { useOfflinePackStore } from '../store/offlinePackStore';

/**
 * Keeps the hidden Android map engine and MapLibre network state alive for the whole session —
 * not only while the Map tab is mounted (Downloads preflight needs this during boot recovery).
 *
 * Hosts must stay under the navigator (see BootGate). A TextureView mounted above the UI
 * blacks out every tab while still allowing tab presses through pointerEvents="none".
 */
export function OfflineMapBootstrap() {
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const ensureHydratedForUi = useOfflinePackStore((s) => s.ensureHydratedForUi);

  useMapLibreNetworkSync();

  useEffect(() => {
    if (!hydrated) {
      void ensureHydratedForUi();
    }
  }, [hydrated, ensureHydratedForUi]);

  return (
    <View
      pointerEvents="box-none"
      style={styles.layer}
      collapsable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="offline.mapBootstrap"
    >
      <OfflineMapEngineHost />
      <DownloadMapSessionHost />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    elevation: 0,
  },
});
