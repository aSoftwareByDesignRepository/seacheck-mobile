import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { Platform, StyleSheet, View } from 'react-native';

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
import { shouldMountOfflineMapEngineHost } from '../../lib/map/chartMapGlPolicy';
import { subscribeEmbeddedChartMapActivity } from '../../lib/map/embeddedChartMapRegistry';
import { subscribeMapScreenFocus } from '../../lib/map/mapScreenFocus';
import { subscribeDownloadCoordinatorActivity } from '../../lib/offline/downloadCoordinator';
import { resolveOfflineEngineCamera } from '../../lib/offline/resolveOfflineEngineCamera';
import { useOfflinePackStore } from '../../store/offlinePackStore';

/** Fallback when tiny hidden maps never emit a full-map render event on some Android builds. */
const RENDER_CONFIRM_FALLBACK_MS = 2_500;

/**
 * Keeps a MapLibre map instance alive on Android so OfflineManager can enumerate tiles
 * even when the Map tab is detached during a Downloads-screen download.
 *
 * Unmounts while the Map tab is focused or a download map owns the GL context.
 */
export function OfflineMapEngineHost() {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);
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
  const mountEligible = useSyncExternalStore(
    (listener) => {
      const unsubFocus = subscribeMapScreenFocus(listener);
      const unsubDownload = subscribeDownloadCoordinatorActivity(listener);
      const unsubEmbed = subscribeEmbeddedChartMapActivity(listener);
      return () => {
        unsubFocus();
        unsubDownload();
        unsubEmbed();
      };
    },
    shouldMountOfflineMapEngineHost,
    () => false,
  );
  /**
   * Defer one frame so EmbeddedChartMap can claim its GL slot in useLayoutEffect
   * before this host mounts a competing MapLibre surface.
   */
  const [mountAllowed, setMountAllowed] = useState(false);
  useEffect(() => {
    if (!mountEligible) {
      setMountAllowed(false);
      return;
    }
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!cancelled && shouldMountOfflineMapEngineHost()) {
        setMountAllowed(true);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [mountEligible]);
  const styleParsedRef = useRef(false);
  const renderConfirmedRef = useRef(false);
  const cameraRef = useRef<CameraRef>(null);
  const renderFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeViewportRef = useRef<OfflineEngineViewport | null>(null);

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
    if (Platform.OS !== 'android' || !chartStyleUri || !mountAllowed) return;
    activeViewportRef.current = camera;
    renderConfirmedRef.current = false;
    cameraRef.current?.jumpTo({ center: camera.center, zoom: camera.zoom });
  }, [chartStyleUri, camera.center, camera.zoom, reloadNonce, viewportGeneration, mountAllowed]);

  if (Platform.OS !== 'android' || !chartStyleUri || !mountAllowed) return null;

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
      renderConfirmedRef.current = true;
      tryMarkReady();
    }, RENDER_CONFIRM_FALLBACK_MS);
  };

  const tryMarkReady = () => {
    if (!styleParsedRef.current || !renderConfirmedRef.current) return;
    clearRenderFallback();
    markOfflineMapEngineStyleLoaded(chartStyleUri, generation);
    const viewport = activeViewportRef.current;
    if (viewport) {
      markOfflineMapEngineViewportPrimed(viewport);
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
      testID="offline.mapEngineHost"
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
