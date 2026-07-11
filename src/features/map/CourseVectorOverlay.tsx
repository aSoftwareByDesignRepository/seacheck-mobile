import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { Feature, LineString, Polygon } from 'geojson';

import { buildCourseVectorGeometry, COURSE_VECTOR_ARROWHEAD_BASE_NM } from '../../lib/geo/courseVector';
import { resolveBoatHeadingDeg } from '../../lib/geo/cog';
import { BOAT_ICON_LENGTH_NM } from '../../lib/geo/boatIcon';
import {
  BOAT_ICON_TARGET_LENGTH_PX,
  chartSymbolOutlineWidth,
  chartSymbolScaleForZoom,
  COURSE_VECTOR_ARROWHEAD_TARGET_PX,
  resolveChartZoom,
} from '../../lib/map/chartSymbolScale';
import {
  MAP_COURSE_VECTOR,
  MAP_COURSE_VECTOR_CASING,
  MAP_COURSE_VECTOR_STALE,
} from '../../lib/map/mapChartColors';
import { isFixStale, useLocationStore, useMapDisplayFix } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';

type Props = {
  mapZoom: number;
  fallbackZoom?: number;
};

/**
 * Navionics-style course vector — long rhumb projection from the boat bow at current SOG.
 * Direction comes from the boat icon; this line shows where you will be in N minutes.
 */
export function CourseVectorOverlay({ mapZoom, fallbackZoom = 13 }: Props) {
  const show = useSettingsStore((s) => s.mapShowCourseVector);
  const vectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const vectorScale = useSettingsStore((s) => s.mapCourseVectorScale);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const mapDisplayFix = useMapDisplayFix();

  const { data, lineWidth, casingWidth } = useMemo(() => {
    if (!show) return { data: { type: 'FeatureCollection' as const, features: [] }, lineWidth: 3, casingWidth: 5 };

    const displayFix = mapDisplayFix ?? fix ?? lastGoodFix;
    if (!displayFix) return { data: { type: 'FeatureCollection' as const, features: [] }, lineWidth: 3, casingWidth: 5 };

    const stale = isFixStale(fix);
    const bearing = resolveBoatHeadingDeg(displayFix);
    const zoom = resolveChartZoom(mapZoom, fallbackZoom);
    const symbolScale = chartSymbolScaleForZoom(
      zoom,
      displayFix.latitude,
      BOAT_ICON_TARGET_LENGTH_PX,
      BOAT_ICON_LENGTH_NM,
    );
    const arrowheadScale = chartSymbolScaleForZoom(
      zoom,
      displayFix.latitude,
      COURSE_VECTOR_ARROWHEAD_TARGET_PX,
      COURSE_VECTOR_ARROWHEAD_BASE_NM,
    );
    const stroke = chartSymbolOutlineWidth(Math.max(symbolScale, arrowheadScale));
    const geom = buildCourseVectorGeometry(
      {
        latitude: displayFix.latitude,
        longitude: displayFix.longitude,
        speedKn: stale ? 0 : displayFix.speedKn,
        bearingDeg: bearing,
      },
      vectorMinutes,
      vectorScale,
      {
        chartZoom: zoom,
        latitudeDeg: displayFix.latitude,
        symbolScale,
        arrowheadScale,
      },
    );

    if (!geom) return { data: { type: 'FeatureCollection' as const, features: [] }, lineWidth: stroke, casingWidth: stroke + 2 };

    const features: Feature[] = [
      {
        type: 'Feature',
        properties: { kind: 'course-vector', stale, lengthNm: geom.lengthNm, visualLengthNm: geom.visualLengthNm },
        geometry: {
          type: 'LineString',
          coordinates: geom.line,
        } satisfies LineString,
      },
      {
        type: 'Feature',
        properties: { kind: 'course-vector-tip', stale },
        geometry: {
          type: 'Polygon',
          coordinates: [geom.arrowhead],
        } satisfies Polygon,
      },
    ];

    return {
      data: { type: 'FeatureCollection' as const, features },
      lineWidth: stroke,
      casingWidth: stroke + 2,
    };
  }, [show, vectorMinutes, vectorScale, fix, lastGoodFix, mapDisplayFix, mapZoom, fallbackZoom]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-course-vector" data={data}>
      <Layer
        id="seacheck-course-vector-casing"
        type="line"
        filter={['==', ['get', 'kind'], 'course-vector']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': MAP_COURSE_VECTOR_CASING,
          'line-width': casingWidth,
          'line-opacity': 0.92,
        }}
      />
      <Layer
        id="seacheck-course-vector-line"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'course-vector'], ['!', ['get', 'stale']]]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': MAP_COURSE_VECTOR,
          'line-width': lineWidth,
          'line-opacity': 0.95,
        }}
      />
      <Layer
        id="seacheck-course-vector-stale"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'course-vector'], ['get', 'stale']]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': MAP_COURSE_VECTOR_STALE,
          'line-width': lineWidth,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2],
        }}
      />
      <Layer
        id="seacheck-course-vector-tip-fill"
        type="fill"
        filter={['all', ['==', ['get', 'kind'], 'course-vector-tip'], ['!', ['get', 'stale']]]}
        paint={{
          'fill-color': MAP_COURSE_VECTOR,
          'fill-opacity': 0.95,
        }}
      />
      <Layer
        id="seacheck-course-vector-tip-stale"
        type="fill"
        filter={['all', ['==', ['get', 'kind'], 'course-vector-tip'], ['get', 'stale']]}
        paint={{
          'fill-color': MAP_COURSE_VECTOR_STALE,
          'fill-opacity': 0.55,
        }}
      />
    </GeoJSONSource>
  );
}
