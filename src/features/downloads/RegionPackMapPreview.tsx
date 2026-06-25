import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection } from 'geojson';

import type { RegionPackDefinition } from '../../map/regionPacks';
import { KIEL_CENTER } from '../../map/constants';
import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  pack: RegionPackDefinition;
};

export function RegionPackMapPreview({ pack }: Props) {
  const { colors, minTouch } = useTheme();
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const [west, south, east, north] = pack.bounds;

  const geojson = useMemo(
    (): FeatureCollection => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'pack-bounds' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
          },
        } satisfies Feature,
      ],
    }),
    [west, south, east, north],
  );

  useEffect(() => {
    if (!ready) return;
    cameraRef.current?.fitBounds(pack.bounds, { padding: { top: 24, right: 24, bottom: 24, left: 24 }, duration: 0 });
  }, [ready, pack.id, pack.bounds]);

  if (!chartStyleUri) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.background }]}
        accessibilityLabel={t('passage.mapPreviewOffline')}
      />
    );
  }

  return (
    <View style={[styles.wrap, { minHeight: Math.max(200, minTouch) }]} testID="downloads.packPreview">
      <Map style={styles.map} mapStyle={chartStyleUri} onDidFinishLoadingMap={() => setReady(true)}>
        <Camera ref={cameraRef} initialViewState={{ center: KIEL_CENTER, zoom: 8 }} />
        <GeoJSONSource id={`pack-preview-${pack.id}`} data={geojson}>
          <Layer id={`pack-preview-fill-${pack.id}`} type="fill" paint={{ 'fill-color': '#0073ad', 'fill-opacity': 0.12 }} />
          <Layer id={`pack-preview-line-${pack.id}`} type="line" paint={{ 'line-color': '#0073ad', 'line-width': 2 }} />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  map: { flex: 1, minHeight: 200 },
  placeholder: { minHeight: 200, borderRadius: 14 },
});
