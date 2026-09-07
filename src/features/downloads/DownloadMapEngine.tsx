import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { firstTileViewport } from '../../lib/offline/tileGrid';
import {
  createDownloadMapController,
  getDownloadMapGeneration,
  invalidateDownloadMapGeneration,
  markDownloadMapFrameRendered,
  markDownloadMapStyleFailed,
  markDownloadMapStyleLoaded,
  noteDownloadMapEngineMounted,
  registerDownloadMapController,
  subscribeDownloadMapGeneration,
} from '../../lib/offline/downloadMapHost';
import { syncOfflineMapEngineFromDownloadMap } from '../../lib/offline/offlineMapEngineHost';
import { resolveOfflineEngineCamera } from '../../lib/offline/resolveOfflineEngineCamera';
import { HIDDEN_MAP_ENGINE_SIZE_PX } from '../../lib/map/hiddenMapEngineLayout';
import { getRegionPack } from '../../map/regionPacks';
import { useOfflinePackStore } from '../../store/offlinePackStore';

export type DownloadMapEngineLayout = 'fill' | 'corner';

type Props = {
  /** `fill` = visible in-navigator chart; `corner` = small underlay (last resort only). */
  layout?: DownloadMapEngineLayout;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Some Android TextureViews never emit full-frame events — same fallback as OfflineMapEngineHost. */
const RENDER_CONFIRM_FALLBACK_MS = 2_500;

/**
 * On-screen MapLibre instance used while a pack download runs.
 * Must actually display base + seamark overlay tiles for the download area
 * (see .cursor/rules/seacheck-offline-downloads.mdc) — invisible hosts alone do not persist.
 *
 * Subscribes to download-map generation so a session reset remounts the GL surface
 * and re-fires style/frame callbacks (stale generation marks are ignored).
 */
export function DownloadMapEngine({
  layout = 'corner',
  style,
  testID = 'downloads.mapEngine',
}: Props) {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);
  const generation = useSyncExternalStore(
    subscribeDownloadMapGeneration,
    getDownloadMapGeneration,
    getDownloadMapGeneration,
  );
  const cameraRef = useRef<CameraRef>(null);
  const frameWaitersRef = useRef<Array<() => void>>([]);
  const styleParsedRef = useRef(false);
  const frameConfirmedRef = useRef(false);
  const renderFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = sessionRegionId != null && chartStyleUri != null;
  const fill = layout === 'fill';

  const packBounds = useMemo(() => {
    if (!sessionRegionId) return null;
    const customBounds = customBoundsIndex[sessionRegionId];
    const pack = getRegionPack(sessionRegionId);
    return customBounds ?? pack?.bounds ?? null;
  }, [sessionRegionId, customBoundsIndex]);

  const initialCamera = useMemo(() => {
    if (!sessionRegionId) return null;
    return resolveOfflineEngineCamera(sessionRegionId, customBoundsIndex);
  }, [sessionRegionId, customBoundsIndex]);

  const startViewport = useMemo(() => {
    if (!sessionRegionId) return null;
    const minZoom = getRegionPack(sessionRegionId)?.minZoom ?? 10;
    if (!packBounds) return initialCamera;
    return firstTileViewport(packBounds, minZoom);
  }, [sessionRegionId, packBounds, initialCamera]);

  const clearRenderFallback = useCallback(() => {
    if (renderFallbackTimerRef.current) {
      clearTimeout(renderFallbackTimerRef.current);
      renderFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    styleParsedRef.current = false;
    frameConfirmedRef.current = false;
    clearRenderFallback();
  }, [generation, chartStyleUri, sessionRegionId, clearRenderFallback]);

  useEffect(() => {
    if (!active || !chartStyleUri) {
      registerDownloadMapController(null);
      return;
    }

    const controller = createDownloadMapController(cameraRef);
    const wrapped = {
      generation,
      showTile: controller.showTile,
      fitBounds: controller.fitBounds,
      waitForFrame: async () => {
        if (generation !== getDownloadMapGeneration()) return;
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
    noteDownloadMapEngineMounted(generation);

    // If style never loads (stuck TextureView), remount once via generation bump.
    const styleWatchdog = setTimeout(() => {
      if (generation !== getDownloadMapGeneration()) return;
      if (styleParsedRef.current) return;
      invalidateDownloadMapGeneration();
    }, 8_000);

    return () => {
      clearTimeout(styleWatchdog);
      clearRenderFallback();
      const waiters = frameWaitersRef.current;
      frameWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
      // Do NOT invalidate generation here. Dep changes (style URI / region / remount)
      // used to bump generation in cleanup, then re-run the effect with a stale
      // generation snapshot — style/frame marks were ignored → DOWNLOAD_MAP_NOT_READY.
      // Session reset + style watchdog own intentional remounts.
      registerDownloadMapController(null);
    };
  }, [active, chartStyleUri, sessionRegionId, generation, clearRenderFallback]);

  if (!active || !chartStyleUri || !startViewport) return null;

  const flushFrameWaiters = () => {
    if (generation !== getDownloadMapGeneration()) return;
    const waiters = frameWaitersRef.current;
    frameWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  };

  const confirmFrame = () => {
    if (generation !== getDownloadMapGeneration()) return;
    if (frameConfirmedRef.current) {
      flushFrameWaiters();
      return;
    }
    frameConfirmedRef.current = true;
    clearRenderFallback();
    flushFrameWaiters();
    markDownloadMapFrameRendered(generation);
    if (startViewport) {
      syncOfflineMapEngineFromDownloadMap(chartStyleUri, startViewport);
    }
  };

  const scheduleRenderFallback = () => {
    clearRenderFallback();
    renderFallbackTimerRef.current = setTimeout(() => {
      // Nudge camera so MapLibre paints at least one tile, then accept readiness.
      if (generation === getDownloadMapGeneration() && startViewport) {
        cameraRef.current?.jumpTo({
          center: startViewport.center,
          zoom: startViewport.zoom,
        });
      }
      confirmFrame();
    }, RENDER_CONFIRM_FALLBACK_MS);
  };

  const onStyleReady = () => {
    if (generation !== getDownloadMapGeneration()) return;
    if (!styleParsedRef.current) {
      styleParsedRef.current = true;
      markDownloadMapStyleLoaded(chartStyleUri, generation);
      scheduleRenderFallback();
    }
  };

  const onFrameReady = () => {
    confirmFrame();
  };

  return (
    <View
      style={[fill ? styles.fillHost : styles.cornerHost, style]}
      testID={testID}
      accessibilityElementsHidden={!fill}
      importantForAccessibility={fill ? 'yes' : 'no-hide-descendants'}
      collapsable={false}
    >
      <Map
        key={`download-engine-${sessionRegionId}-${generation}`}
        style={fill ? styles.fillMap : styles.cornerMap}
        mapStyle={chartStyleUri}
        androidView={
          // Match NavigationMap: TextureView is the proven Android path for raster tiles.
          Platform.OS === 'android' ? 'texture' : undefined
        }
        attribution={fill}
        logo={false}
        compass={false}
        scaleBar={false}
        onDidFinishLoadingStyle={onStyleReady}
        onDidFinishLoadingMap={onStyleReady}
        onDidFinishRenderingFrameFully={onFrameReady}
        onDidFinishRenderingMapFully={onFrameReady}
        onDidFailLoadingMap={() => markDownloadMapStyleFailed(chartStyleUri, generation)}
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
  fillHost: {
    flex: 1,
    width: '100%',
    minHeight: 180,
    overflow: 'hidden',
  },
  fillMap: {
    ...StyleSheet.absoluteFill,
  },
  cornerHost: {
    width: HIDDEN_MAP_ENGINE_SIZE_PX,
    height: HIDDEN_MAP_ENGINE_SIZE_PX,
    overflow: 'hidden',
  },
  cornerMap: {
    width: HIDDEN_MAP_ENGINE_SIZE_PX,
    height: HIDDEN_MAP_ENGINE_SIZE_PX,
  },
});
