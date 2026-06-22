import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { KIEL_CENTER } from '../../map/constants';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import type { LegCoverage } from '../../lib/map/coverage';
import type { PassageWithLegs } from '../../store/passageStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  detail: PassageWithLegs;
  legCoverage: LegCoverage[];
  highlightedLegIndex: number | null;
  onLegPress: (legIndex: number) => void;
};

export function PassageMapPreview({ detail, legCoverage, highlightedLegIndex, onLegPress }: Props) {
  const { colors, minTouch } = useTheme();
  const chartStyleUri = useOfflinePackStore((s) => s.chartStyleUri);
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const bounds = useMemo(() => boundsFromWaypoints(detail.waypoints), [detail.waypoints]);

  useEffect(() => {
    if (!ready || !bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding: { top: 24, right: 24, bottom: 24, left: 24 }, duration: 0 });
  }, [ready, bounds, detail.id]);

  const geojson = useMemo(() => buildPreviewGeoJson(detail, legCoverage, highlightedLegIndex), [detail, legCoverage, highlightedLegIndex]);

  if (!chartStyleUri) {
    return <View style={[styles.placeholder, { backgroundColor: colors.background }]} accessibilityLabel="Map preview unavailable without offline charts" />;
  }

  return (
    <View style={[styles.wrap, { minHeight: Math.max(220, minTouch) }]} testID="passage.mapPreview">
      <Map
        style={styles.map}
        mapStyle={chartStyleUri}
        attribution={false}
        compass={false}
        scaleBar={false}
        onDidFinishLoadingMap={() => setReady(true)}
      >
        <Camera ref={cameraRef} initialViewState={{ center: bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : KIEL_CENTER, zoom: 10, bearing: 0, pitch: 0 }} />
        <GeoJSONSource
          id="seacheck-passage-preview"
          data={geojson}
          onPress={(e) => {
            const feature = e.nativeEvent.features?.find((f) => f.properties?.kind === 'preview-leg');
            const legIndex = feature?.properties?.legIndex;
            if (typeof legIndex === 'number') onLegPress(legIndex);
          }}
        >
          <Layer
            id="seacheck-passage-preview-leg"
            type="line"
            filter={['==', ['get', 'kind'], 'preview-leg']}
            style={{
              lineColor: ['case', ['get', 'highlight'], colors.primary, ['get', 'covered'], '#2e7d32', '#c62828'],
              lineWidth: ['case', ['get', 'highlight'], 5, 3],
              lineOpacity: 0.95,
            }}
          />
          <Layer
            id="seacheck-passage-preview-wp"
            type="circle"
            filter={['==', ['get', 'kind'], 'preview-wp']}
            style={{
              circleRadius: 7,
              circleColor: colors.primary,
              circleStrokeWidth: 2,
              circleStrokeColor: '#ffffff',
            }}
          />
          <Layer
            id="seacheck-passage-preview-label"
            type="symbol"
            filter={['==', ['get', 'kind'], 'preview-wp']}
            style={{
              textField: ['get', 'label'],
              textSize: 12,
              textOffset: [0, 1.2],
              textColor: colors.text,
              textHaloColor: '#ffffff',
              textHaloWidth: 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

function buildPreviewGeoJson(
  detail: PassageWithLegs,
  legCoverage: LegCoverage[],
  highlightedLegIndex: number | null,
): FeatureCollection {
  const coverageByLeg = Object.fromEntries(legCoverage.map((l) => [l.legIndex, l.covered])) as Record<number, boolean>;
  const features: Feature[] = [];

  for (const leg of detail.legs) {
    const line: LineString = {
      type: 'LineString',
      coordinates: [
        [leg.from.longitude, leg.from.latitude],
        [leg.to.longitude, leg.to.latitude],
      ],
    };
    features.push({
      type: 'Feature',
      properties: {
        kind: 'preview-leg',
        legIndex: leg.index,
        covered: coverageByLeg[leg.index] ?? false,
        highlight: leg.index === highlightedLegIndex,
      },
      geometry: line,
    });
  }

  detail.waypoints.forEach((wp, index) => {
    const pt: Point = { type: 'Point', coordinates: [wp.longitude, wp.latitude] };
    features.push({
      type: 'Feature',
      properties: { kind: 'preview-wp', label: `${index + 1}` },
      geometry: pt,
    });
  });

  return { type: 'FeatureCollection', features };
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', minHeight: 220 },
  map: { flex: 1, minHeight: 220 },
  placeholder: { minHeight: 220, borderRadius: 14 },
});
