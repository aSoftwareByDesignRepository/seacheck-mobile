import { StyleSheet, View } from 'react-native';

import { shouldMountDownloadMapSession } from '../../lib/map/chartMapGlPolicy';
import { HIDDEN_MAP_ENGINE_SIZE_PX } from '../../lib/map/hiddenMapEngineLayout';
import { DownloadMapEngine } from './DownloadMapEngine';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/**
 * Keeps the tile-sweep map mounted whenever a cache-backed download runs — on any tab.
 * Android only renders MapLibre into the ambient tile cache when the map is in the
 * viewport; this host stays on-screen (near-transparent, fixed size) so sweeps work
 * after custom area picks on the Map tab, not only from the Downloads screen.
 *
 * Must stay a small corner host — a fullscreen TextureView ignores parent opacity on
 * Android and paints an opaque black/ocean layer over the entire app.
 */
export function DownloadMapSessionHost() {
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const regions = useOfflinePackStore((s) => s.regions);

  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = sessionRegionId != null ? regions[sessionRegionId] : undefined;
  const active =
    sessionRegionId != null &&
    shouldMountDownloadMapSession(
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
    width: HIDDEN_MAP_ENGINE_SIZE_PX,
    height: HIDDEN_MAP_ENGINE_SIZE_PX,
    maxWidth: HIDDEN_MAP_ENGINE_SIZE_PX,
    maxHeight: HIDDEN_MAP_ENGINE_SIZE_PX,
    // Bottom-right — OfflineMapEngineHost uses bottom-left when mounted.
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    opacity: 0.01,
    elevation: 0,
    zIndex: 0,
  },
});
