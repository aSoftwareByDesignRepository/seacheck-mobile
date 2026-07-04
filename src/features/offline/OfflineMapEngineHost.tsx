import { useSyncExternalStore } from 'react';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import {
  getOfflineMapEngineStyleReloadNonce,
  markOfflineMapEngineStyleFailed,
  markOfflineMapEngineStyleLoaded,
  subscribeOfflineMapEngineStyleReload,
} from '../../lib/offline/offlineMapEngineHost';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/** Baltic center — ensures raster sources initialize on the hidden engine. */
const ENGINE_CENTER: [number, number] = [10.15, 54.32];

/**
 * Keeps a MapLibre map instance alive on Android so OfflineManager can enumerate tiles
 * even when the Map tab is detached during a Downloads-screen download.
 */
export function OfflineMapEngineHost() {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const reloadNonce = useSyncExternalStore(
    subscribeOfflineMapEngineStyleReload,
    getOfflineMapEngineStyleReloadNonce,
    getOfflineMapEngineStyleReloadNonce,
  );

  if (Platform.OS !== 'android' || !chartStyleUri) return null;

  const generation = reloadNonce;
  const markLoaded = () => markOfflineMapEngineStyleLoaded(chartStyleUri, generation);
  const markFailed = () => markOfflineMapEngineStyleFailed(chartStyleUri, generation);

  return (
    <View
      style={styles.host}
      pointerEvents="none"
      collapsable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Map
        key={`offline-engine-${reloadNonce}`}
        style={styles.map}
        mapStyle={chartStyleUri}
        androidView="texture"
        onDidFinishLoadingStyle={markLoaded}
        onDidFinishLoadingMap={markLoaded}
        onDidFailLoadingMap={() => {
          console.warn('[OfflineMapEngineHost] hidden map failed to load chart style');
          markFailed();
        }}
      >
        <Camera initialViewState={{ center: ENGINE_CENTER, zoom: 10 }} />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Must stay in the viewport — Android skips GL rendering for off-screen maps,
   * which stalls OfflineManager tile enumeration when the Map tab is not visible.
   */
  host: {
    position: 'absolute',
    width: 64,
    height: 64,
    overflow: 'hidden',
    left: 0,
    bottom: 0,
    opacity: 0,
    zIndex: -1,
  },
  map: {
    width: 64,
    height: 64,
  },
});
