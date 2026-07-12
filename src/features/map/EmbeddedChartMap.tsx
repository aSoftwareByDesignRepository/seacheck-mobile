import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Camera, Map, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native';

import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { KIEL_CENTER } from '../../map/constants';
import { useOfflinePackStore } from '../../store/offlinePackStore';

type FitPadding = { top: number; right: number; bottom: number; left: number };

const DEFAULT_FIT_PADDING: FitPadding = { top: 24, right: 24, bottom: 24, left: 24 };

type Props = {
  mapKey: string;
  height: number;
  minHeight?: number;
  testID?: string;
  accessibilityLabel?: string;
  fitBounds?: LngLatBounds | null;
  fitPadding?: FitPadding;
  borderRadius?: number;
  placeholder?: ReactNode;
  children?: ReactNode;
};

/**
 * Embedded MapLibre chart for scroll views and side panels.
 * Android needs `collapsable={false}` and `androidView="texture"` or the GL surface stays blank.
 */
export function EmbeddedChartMap({
  mapKey,
  height,
  minHeight,
  testID,
  accessibilityLabel,
  fitBounds = null,
  fitPadding = DEFAULT_FIT_PADDING,
  borderRadius = 14,
  placeholder = null,
  children,
}: Props) {
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const exclusiveChartDownload = useExclusiveChartDownloadSession();
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);

  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    setReady(false);
  }, [chartStyleUri, mapKey]);

  useEffect(() => {
    if (!ready || !fitBounds) return;
    cameraRef.current?.fitBounds(fitBounds, { padding: fitPadding, duration: 0 });
  }, [ready, fitBounds, fitPadding, mapKey]);

  if (!chartStyleUri || exclusiveChartDownload) {
    return <>{placeholder}</>;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          height,
          minHeight: minHeight ?? height,
          borderRadius,
        },
      ]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      collapsable={false}
    >
      <Map
        key={mapKey}
        style={styles.map}
        mapStyle={chartStyleUri}
        androidView={Platform.OS === 'android' ? 'texture' : undefined}
        onDidFinishLoadingStyle={markReady}
        onDidFinishLoadingMap={markReady}
      >
        <Camera ref={cameraRef} initialViewState={{ center: KIEL_CENTER, zoom: 8 }} />
        {children}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFill },
});
