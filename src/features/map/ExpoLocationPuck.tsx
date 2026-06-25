import { Layer, LayerAnnotation } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { isFixStale, useLocationStore } from '../../services/locationService';

/** MapLibre blue — matches app primary on water charts. */
const PUCK_BLUE = '#0073ad';
const PUCK_STALE = '#6b7280';

/**
 * Position puck driven by expo-location only.
 * Avoids MapLibre's native LocationManager (duplicate GPS + bridge OOM on Android).
 */
export function ExpoLocationPuck() {
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const displayFix = fix ?? lastGoodFix;

  const lngLat = useMemo((): [number, number] | null => {
    if (!displayFix) return null;
    return [displayFix.longitude, displayFix.latitude];
  }, [displayFix?.longitude, displayFix?.latitude]);

  if (!lngLat || !displayFix) return null;

  const stale = isFixStale(fix);
  const puckColor = stale ? PUCK_STALE : PUCK_BLUE;
  const accuracyM =
    !stale && displayFix.accuracyM != null && displayFix.accuracyM > 0 ? displayFix.accuracyM : null;
  const showAccuracy = accuracyM != null;

  // MapLibre Layer ids are frozen on mount — never conditionally mount/unmount Layer children.
  return (
    <LayerAnnotation animated id="seacheck-user-location" testID="map.userLocation" lngLat={lngLat}>
      <Layer
        key="seacheck-user-location-accuracy"
        type="circle"
        id="seacheck-user-location-accuracy"
        source="seacheck-user-location"
        paint={{
          'circle-color': puckColor,
          'circle-opacity': showAccuracy ? 0.18 : 0,
          'circle-pitch-alignment': 'map',
          'circle-radius': showAccuracy
            ? [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                9,
                22,
                9 + accuracyM * 100,
              ]
            : 0,
        }}
      />
      <Layer
        key="seacheck-user-location-white"
        type="circle"
        id="seacheck-user-location-white"
        source="seacheck-user-location"
        paint={{
          'circle-radius': 9,
          'circle-color': '#fff',
          'circle-pitch-alignment': 'map',
        }}
      />
      <Layer
        key="seacheck-user-location-blue"
        type="circle"
        id="seacheck-user-location-blue"
        source="seacheck-user-location"
        paint={{
          'circle-radius': 6,
          'circle-color': puckColor,
          'circle-pitch-alignment': 'map',
        }}
      />
    </LayerAnnotation>
  );
}
