import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { KIEL_CENTER } from '../../map/constants';
import { MAP_EMBED_PREVIEW_HEIGHT } from '../../map/previewConstants';
import { boundsFromWaypoints } from '../../lib/map/passageBounds';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
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
  const chartBaseStyle = useSettingsStore((s) => s.chartBaseStyle);
  const seamarkPlanning = useSettingsStore((s) => s.seamarkPlanning);
  const mapShowPassageRouteLines = useSettingsStore((s) => s.mapShowPassageRouteLines);
  const offlineRegions = useOfflinePackStore((s) => s.regions);
  const hasReadyPack = selectHasReadyOfflinePack(offlineRegions);
  const isOffline = useIsEffectivelyOffline();
  const cameraRef = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);
  const bounds = useMemo(() => boundsFromWaypoints(detail.waypoints), [detail.waypoints]);
  const previewCenter = useMemo(() => {
    if (!bounds) return { latitude: null as number | null, longitude: null as number | null };
    return { latitude: (bounds[1] + bounds[3]) / 2, longitude: (bounds[0] + bounds[2]) / 2 };
  }, [bounds]);
  const previewCoverage = useChartCoverageAtPoint(previewCenter.latitude, previewCenter.longitude);
  const previewOfflineUnavailable = isOffline && (!hasReadyPack || !previewCoverage.covered);
  const previewZoom = 10;

  useEffect(() => {
    setReady(false);
  }, [chartBaseStyle, chartStyleUri]);

  useEffect(() => {
    if (!ready || !bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding: { top: 24, right: 24, bottom: 24, left: 24 }, duration: 0 });
  }, [ready, bounds, detail.id]);

  const geojson = useMemo(() => {
    const full = buildPreviewGeoJson(detail, legCoverage, highlightedLegIndex, distanceUnit);
    if (mapShowPassageRouteLines) return full;
    return {
      type: 'FeatureCollection' as const,
      features: full.features.filter((f) => f.properties?.kind === 'preview-wp'),
    };
  }, [detail, legCoverage, highlightedLegIndex, distanceUnit, mapShowPassageRouteLines]);

  if (!chartStyleUri || previewOfflineUnavailable) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: colors.background }]}
        accessibilityLabel={previewOfflineUnavailable ? t('map.chartsNotHere') : t('passage.mapPreviewOffline')}
      >
        {previewOfflineUnavailable ? (
          <>
            <Text style={[styles.placeholderTitle, { color: colors.text }]} accessibilityRole="header">
              {t('map.chartsNotHere')}
            </Text>
            <Text style={[styles.placeholderBody, { color: colors.textMuted }]}>{t('map.chartsNotHereHint')}</Text>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[styles.wrap, { height: MAP_EMBED_PREVIEW_HEIGHT, minHeight: Math.max(MAP_EMBED_PREVIEW_HEIGHT, minTouch) }]}
      testID="passage.mapPreview"
    >
      <Map
        key={`passage-preview-${detail.id}-${chartBaseStyle}`}
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
            if (!mapShowPassageRouteLines) return;
            const feature = e.nativeEvent.features?.find((f) => f.properties?.kind === 'preview-leg');
            const legIndex = feature?.properties?.legIndex;
            if (typeof legIndex === 'number') onLegPress(legIndex);
          }}
        >
          {mapShowPassageRouteLines ? (
            <>
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
            </>
          ) : null}
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
  wrap: { borderRadius: 14, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFill },
  placeholder: { minHeight: MAP_EMBED_PREVIEW_HEIGHT, borderRadius: 14, padding: 16, justifyContent: 'center', gap: 8 },
  placeholderTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  placeholderBody: { fontSize: 14, lineHeight: 20 },
});
