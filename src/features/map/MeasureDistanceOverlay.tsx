import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { bearingTrue, distanceNm, type LonLat } from '../../lib/geo/navigation';
import { formatMapDistanceLabel, legMidpoint } from '../../lib/geo/pathDistance';
import { useMeasureDistanceStore } from '../../store/measureDistanceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';

const MEASURE_LINE = '#c62828';
const MEASURE_FILL = '#c62828';

/** Rhumb path and segment labels for the distance ruler. */
export function MeasureDistanceOverlay() {
  const { colors } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const active = useMeasureDistanceStore((s) => s.active);
  const points = useMeasureDistanceStore((s) => s.points);

  const geojson = useMemo((): FeatureCollection => {
    if (!active || points.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features: Feature[] = points.map((pt, index) => ({
      type: 'Feature',
      properties: { kind: 'measure-vertex', index: index + 1 },
      geometry: { type: 'Point', coordinates: [pt.longitude, pt.latitude] } satisfies Point,
    }));

    if (points.length >= 2) {
      const line: LineString = {
        type: 'LineString',
        coordinates: points.map((pt) => [pt.longitude, pt.latitude]),
      };
      features.push({
        type: 'Feature',
        properties: { kind: 'measure-line' },
        geometry: line,
      });

      for (let i = 1; i < points.length; i++) {
        const from = points[i - 1]!;
        const to = points[i]!;
        const fromLl: LonLat = [from.longitude, from.latitude];
        const toLl: LonLat = [to.longitude, to.latitude];
        const segNm = distanceNm(fromLl, toLl);
        const brg = Math.round(bearingTrue(fromLl, toLl));
        features.push({
          type: 'Feature',
          properties: {
            kind: 'measure-segment-label',
            label: `${formatMapDistanceLabel(segNm, distanceUnit)} · ${brg}°`,
          },
          geometry: {
            type: 'Point',
            coordinates: legMidpoint(from, to),
          },
        });
      }
    }

    return { type: 'FeatureCollection', features };
  }, [active, distanceUnit, points]);

  if (!active) return null;

  return (
    <GeoJSONSource id="seacheck-measure" data={geojson}>
      <Layer
        id="seacheck-measure-line"
        type="line"
        filter={['==', ['get', 'kind'], 'measure-line']}
        style={{
          lineColor: MEASURE_LINE,
          lineWidth: 4,
          lineOpacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <Layer
        id="seacheck-measure-vertex-outer"
        type="circle"
        filter={['==', ['get', 'kind'], 'measure-vertex']}
        style={{
          circleRadius: 9,
          circleColor: colors.surface,
          circleStrokeWidth: 3,
          circleStrokeColor: MEASURE_FILL,
        }}
      />
      <Layer
        id="seacheck-measure-vertex-inner"
        type="circle"
        filter={['==', ['get', 'kind'], 'measure-vertex']}
        style={{
          circleRadius: 4,
          circleColor: MEASURE_FILL,
        }}
      />
      <Layer
        id="seacheck-measure-segment-label"
        type="symbol"
        filter={['==', ['get', 'kind'], 'measure-segment-label']}
        style={{
          textField: ['get', 'label'],
          textSize: 13,
          textColor: '#5d0000',
          textHaloColor: colors.surface,
          textHaloWidth: 2,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </GeoJSONSource>
  );
}
