import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { offlineEnginePostSessionRemountMs } from '../../lib/offline/downloadMapConstants';
import { isMapScreenFocused, subscribeMapScreenFocus } from '../../lib/map/mapScreenFocus';

import {
  getOfflineMapEngineStyleReloadNonce,
  getOfflineMapEngineViewportGeneration,
  getPendingOfflineMapEngineViewport,
  markOfflineMapEngineStyleFailed,
  markOfflineMapEngineStyleLoaded,
  markOfflineMapEngineViewportPrimed,
  subscribeOfflineMapEngineStyleReload,
  subscribeOfflineMapEngineViewport,
  type OfflineEngineViewport,
} from '../../lib/offline/offlineMapEngineHost';
import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { resolveOfflineEngineCamera } from '../../lib/offline/resolveOfflineEngineCamera';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/** Fallback when tiny hidden maps never emit a full-map render event on some Android builds. */
const RENDER_CONFIRM_FALLBACK_MS = 8_000;

/**
 * Keeps a MapLibre map instance alive on Android so OfflineManager can enumerate tiles
 * even when the Map tab is detached during a Downloads-screen download.
 */
export function OfflineMapEngineHost() {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);
  const exclusiveDownloadMap = useExclusiveChartDownloadSession();
  const mapTabFocused = useSyncExternalStore(
    subscribeMapScreenFocus,
    isMapScreenFocused,
    () => false,
  );
  const reloadNonce = useSyncExternalStore(
    subscribeOfflineMapEngineStyleReload,
    getOfflineMapEngineStyleReloadNonce,
    getOfflineMapEngineStyleReloadNonce,
  );
  const viewportGeneration = useSyncExternalStore(
    subscribeOfflineMapEngineViewport,
    getOfflineMapEngineViewportGeneration,
    getOfflineMapEngineViewportGeneration,
  );
  const pendingViewport = useSyncExternalStore(
    subscribeOfflineMapEngineViewport,
    getPendingOfflineMapEngineViewport,
    getPendingOfflineMapEngineViewport,
  );
  const styleParsedRef = useRef(false);
  const renderConfirmedRef = useRef(false);
  const cameraRef = useRef<CameraRef>(null);
  const renderFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeViewportRef = useRef<OfflineEngineViewport | null>(null);
  const [postSessionHoldback, setPostSessionHoldback] = useState(false);
  const [prevExclusive, setPrevExclusive] = useState(exclusiveDownloadMap);

  // When the exclusive download session ends, the download map unmounts and
  // NavigationMap remounts in the same commit. Delay this hidden map's remount so
  // Android never creates two new GL surfaces in the frame that also destroys one.
  // Derived during render (not in an effect) so the map is never mounted for the
  // single transition frame before an effect could hide it again.
  if (prevExclusive !== exclusiveDownloadMap) {
    setPrevExclusive(exclusiveDownloadMap);
    if (exclusiveDownloadMap) {
      setPostSessionHoldback(false);
    } else if (offlineEnginePostSessionRemountMs() > 0) {
      setPostSessionHoldback(true);
    }
  }

  useEffect(() => {
    if (!postSessionHoldback) return;
    const timer = setTimeout(() => setPostSessionHoldback(false), offlineEnginePostSessionRemountMs());
    return () => clearTimeout(timer);
  }, [postSessionHoldback]);

  const fallbackCamera = resolveOfflineEngineCamera(activeDownloadRegionId, customBoundsIndex);
  const camera = pendingViewport ?? fallbackCamera;

  useEffect(() => {
    styleParsedRef.current = false;
    renderConfirmedRef.current = false;
    activeViewportRef.current = null;
    if (renderFallbackTimerRef.current) {
      clearTimeout(renderFallbackTimerRef.current);
      renderFallbackTimerRef.current = null;
    }
  }, [reloadNonce, chartStyleUri]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !chartStyleUri) return;
    activeViewportRef.current = camera;
    renderConfirmedRef.current = false;
    cameraRef.current?.jumpTo({ center: camera.center, zoom: camera.zoom });
  }, [chartStyleUri, camera.center, camera.zoom, reloadNonce, viewportGeneration]);

  if (Platform.OS !== 'android' || !chartStyleUri || exclusiveDownloadMap || postSessionHoldback || mapTabFocused) {
    return null;
  }

  const generation = reloadNonce;

  const clearRenderFallback = () => {
    if (renderFallbackTimerRef.current) {
      clearTimeout(renderFallbackTimerRef.current);
      renderFallbackTimerRef.current = null;
    }
  };

  const scheduleRenderFallback = () => {
    clearRenderFallback();
    renderFallbackTimerRef.current = setTimeout(() => {
      if (!styleParsedRef.current) return;
      renderConfirmedRef.current = true;
      markOfflineMapEngineStyleLoaded(chartStyleUri, generation);
    }, RENDER_CONFIRM_FALLBACK_MS);
  };

  const tryMarkReady = () => {
    if (!styleParsedRef.current || !renderConfirmedRef.current) return;
    clearRenderFallback();
    markOfflineMapEngineStyleLoaded(chartStyleUri, generation);
    const viewport = activeViewportRef.current;
    if (viewport) {
      markOfflineMapEngineViewportPrimed(viewport, viewportGeneration);
    }
  };

  const markRenderConfirmed = () => {
    renderConfirmedRef.current = true;
    tryMarkReady();
  };

  const markStyleParsed = () => {
    if (styleParsedRef.current) return;
    styleParsedRef.current = true;
    scheduleRenderFallback();
    tryMarkReady();
  };

  const markFailed = () => {
    clearRenderFallback();
    markOfflineMapEngineStyleFailed(chartStyleUri, generation);
  };

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
        onDidFinishLoadingStyle={() => {
          markStyleParsed();
        }}
        onDidFinishLoadingMap={() => {
          markStyleParsed();
        }}
        onDidFinishRenderingMapFully={() => {
          markRenderConfirmed();
        }}
        onDidFinishRenderingFrameFully={() => {
          markRenderConfirmed();
        }}
        onDidFailLoadingMap={() => {
          console.warn('[OfflineMapEngineHost] hidden map failed to load chart style');
          markFailed();
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: camera.center, zoom: camera.zoom }}
        />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Must stay in the viewport — Android skips GL rendering for off-screen maps,
   * which stalls OfflineManager tile enumeration when the Map tab is not visible.
   * Avoid zIndex below zero; some Android builds stop compositing invisible layers.
   */
  host: {
    position: 'absolute',
    width: 256,
    height: 256,
    overflow: 'hidden',
    left: 0,
    bottom: 0,
    opacity: 0.01,
    elevation: 0,
  },
  map: {
    width: 256,
    height: 256,
  },
});
