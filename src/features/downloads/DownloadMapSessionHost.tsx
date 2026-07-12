import { StyleSheet, View } from 'react-native';

import { isDownloadMapSessionActive } from './packDownloadPresentation';
import { DownloadMapEngine } from './DownloadMapEngine';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/**
 * Keeps the tile-sweep map mounted whenever a cache-backed download runs — on any tab.
 * Android only renders MapLibre into the ambient tile cache when the map is in the
 * viewport; this host stays on-screen (near-transparent) so sweeps work after custom
 * area picks on the Map tab, not only from the Downloads screen.
 */
export function DownloadMapSessionHost() {
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const regions = useOfflinePackStore((s) => s.regions);

  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = sessionRegionId != null ? regions[sessionRegionId] : undefined;
  const active =
    sessionRegionId != null &&
    isDownloadMapSessionActive(
      sessionRegionId,
      status ?? { state: 'idle' },
      activeDownloadRegionId,
      downloadMapTeardownRegionId,
    );

  if (!active) return null;

  return (
    <View
      style={styles.host}
      pointerEvents="none"
      collapsable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="downloads.mapSessionHost"
    >
      <DownloadMapEngine />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 280,
    height: 240,
    overflow: 'hidden',
    left: 0,
    bottom: 0,
    opacity: 0.01,
    elevation: 0,
  },
});
