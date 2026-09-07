import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { shouldMountDownloadMapSession } from '../../lib/map/chartMapGlPolicy';
import { HIDDEN_MAP_ENGINE_SIZE_PX } from '../../lib/map/hiddenMapEngineLayout';
import {
  resolveDownloadMapSlot,
  subscribeDownloadMapSlot,
} from '../../lib/offline/downloadMapSlot';
import { DownloadMapEngine } from './DownloadMapEngine';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/**
 * Last-resort corner underlay while waiting for Map/Downloads to claim the sticky
 * visible host. Tile sweep pauses until a visible slot is available — this host
 * alone is not enough for permanent offline saves.
 */
export function DownloadMapSessionHost() {
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const regions = useOfflinePackStore((s) => s.regions);
  const slot = useSyncExternalStore(subscribeDownloadMapSlot, resolveDownloadMapSlot, resolveDownloadMapSlot);

  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = sessionRegionId != null ? regions[sessionRegionId] : undefined;
  const sessionActive =
    sessionRegionId != null &&
    shouldMountDownloadMapSession(
      sessionRegionId,
      status ?? { state: 'idle' },
      activeDownloadRegionId,
      downloadMapTeardownRegionId,
    );

  // Sticky Map/Downloads hosts own the GL surface — never mount a competing corner engine.
  if (!sessionActive || slot !== 'corner') return null;

  return (
    <View
      style={styles.host}
      pointerEvents="none"
      collapsable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="downloads.mapSessionHost"
    >
      <DownloadMapEngine layout="corner" />
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
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    opacity: 0.01,
    elevation: 0,
    zIndex: 0,
  },
});
