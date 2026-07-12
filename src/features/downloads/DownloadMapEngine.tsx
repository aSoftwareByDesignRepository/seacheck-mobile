import { useEffect, useMemo, useRef } from 'react';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { firstTileViewport } from '../../lib/offline/tileGrid';
import {
  createDownloadMapController,
  getDownloadMapGeneration,
  invalidateDownloadMapGeneration,
  markDownloadMapStyleFailed,
  markDownloadMapStyleLoaded,
  registerDownloadMapController,
} from '../../lib/offline/downloadMapHost';
import { resolveOfflineEngineCamera } from '../../lib/offline/resolveOfflineEngineCamera';
import { getRegionPack } from '../../map/regionPacks';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/**
 * Visible chart map used while a pack download runs. Android needs a real on-screen
 * MapLibre instance to fetch and persist tiles into the ambient cache reliably.
 */
export function DownloadMapEngine() {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);
  const cameraRef = useRef<CameraRef>(null);
  const frameWaitersRef = useRef<Array<() => void>>([]);
  const mapGenerationRef = useRef(getDownloadMapGeneration());

  const active = sessionRegionId != null && chartStyleUri != null;

  const initialCamera = useMemo(() => {
    if (!sessionRegionId) return null;
    return resolveOfflineEngineCamera(sessionRegionId, customBoundsIndex);
  }, [sessionRegionId, customBoundsIndex]);

  const startViewport = useMemo(() => {
    if (!sessionRegionId) return null;
    const customBounds = customBoundsIndex[sessionRegionId];
    const pack = getRegionPack(sessionRegionId);
    const bounds = customBounds ?? pack?.bounds;
    const minZoom = pack?.minZoom ?? 10;
    if (!bounds) return initialCamera;
    return firstTileViewport(bounds, minZoom);
  }, [sessionRegionId, customBoundsIndex, initialCamera]);

  useEffect(() => {
    if (!active || !chartStyleUri) {
      registerDownloadMapController(null);
      return;
    }

    mapGenerationRef.current = getDownloadMapGeneration();
    const controller = createDownloadMapController(cameraRef);
    const wrapped = {
      fitBounds: controller.fitBounds,
      waitForFrame: async () => {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 3_500);
          frameWaitersRef.current.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      },
    };
    registerDownloadMapController(wrapped);

    return () => {
      const waiters = frameWaitersRef.current;
      frameWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
      invalidateDownloadMapGeneration();
      registerDownloadMapController(null);
    };
  }, [active, chartStyleUri, sessionRegionId]);

  if (!active || !chartStyleUri || !startViewport) return null;

  const mapGeneration = mapGenerationRef.current;

  const flushFrameWaiters = () => {
    if (mapGeneration !== getDownloadMapGeneration()) return;
    const waiters = frameWaitersRef.current;
    frameWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  };

  return (
    <View
      style={styles.host}
      testID="downloads.mapEngine"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
    >
      <Map
        key={`download-engine-${sessionRegionId}-${mapGeneration}`}
        style={styles.map}
        mapStyle={chartStyleUri}
        androidView={Platform.OS === 'android' ? 'texture' : undefined}
        onDidFinishLoadingStyle={() => markDownloadMapStyleLoaded(chartStyleUri, mapGeneration)}
        onDidFinishLoadingMap={() => markDownloadMapStyleLoaded(chartStyleUri, mapGeneration)}
        onDidFinishRenderingFrameFully={flushFrameWaiters}
        onDidFinishRenderingMapFully={flushFrameWaiters}
        onDidFailLoadingMap={() => markDownloadMapStyleFailed(chartStyleUri, mapGeneration)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: startViewport.center, zoom: startViewport.zoom }}
        />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    height: MAP_EMBED_PREVIEW_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  map: { flex: 1 },
});
