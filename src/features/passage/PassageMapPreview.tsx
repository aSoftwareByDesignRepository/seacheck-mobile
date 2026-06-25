import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { KIEL_CENTER } from '../../map/constants';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import { PlanningSeamarksOverlay } from '../map/PlanningSeamarksOverlay';
import { formatMapDistanceLabel, legMidpoint } from '../../lib/geo/pathDistance';
import { t } from '../../i18n';
import type { LegCoverage } from '../../lib/map/coverage';
import type { PassageWithLegs } from '../../store/passageStore';
import type { DistanceUnit } from '../../settings/defaults';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
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
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const seamarkPlanning = useSettingsStore((s) => s.seamarkPlanning);
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const bounds = useMemo(() => boundsFromWaypoints(detail.waypoints), [detail.waypoints]);
  const previewZoom = 10;

  useEffect(() => {
    if (!ready || !bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding: { top: 24, right: 24, bottom: 24, left: 24 }, duration: 0 });
  }, [ready, bounds, detail.id]);

  const geojson = useMemo(
    () => buildPreviewGeoJson(detail, legCoverage, highlightedLegIndex, distanceUnit),
    [detail, legCoverage, highlightedLegIndex, distanceUnit],
  );

  if (!chartStyleUri) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.background }]}
        accessibilityLabel={t('passage.mapPreviewOffline')}
      />
    );
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
        <Camera ref={cameraRef} initialViewState={{ center: bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : KIEL_CENTER, zoom: previewZoom, bearing: 0, pitch: 0 }} />
        {bounds ? (
          <PlanningSeamarksOverlay
            bounds={bounds}
            centerLatitude={(bounds[1] + bounds[3]) / 2}
            centerLongitude={(bounds[0] + bounds[2]) / 2}
            zoom={previewZoom}
            config={seamarkPlanning}
          />
        ) : null}
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
            id="seacheck-passage-preview-dist"
            type="symbol"
            filter={['==', ['get', 'kind'], 'preview-leg-label']}
            style={{
              textField: ['get', 'label'],
              textSize: 12,
              textColor: colors.text,
              textHaloColor: '#ffffff',
              textHaloWidth: 1.5,
            }}
          />
          <Layer
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
  distanceUnit: DistanceUnit,
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
    features.push({
      type: 'Feature',
      properties: {
        kind: 'preview-leg-label',
        label: formatMapDistanceLabel(leg.distanceNm, distanceUnit),
      },
      geometry: {
        type: 'Point',
        coordinates: legMidpoint(leg.from, leg.to),
      },
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
