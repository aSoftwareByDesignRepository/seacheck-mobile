import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';

import { buildCourseVectorGeometry } from '../../lib/geo/courseVector';
import { displayCog, isFixStale, useLocationStore } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';

const VECTOR_BLUE = '#0073ad';
const VECTOR_STALE = '#6b7280';

/**
 * Chart-plotter course vector from the boat — 6-minute projection at current SOG,
 * plus a small heading wedge on the puck for direction at a glance.
 */
export function CourseVectorOverlay() {
  const show = useSettingsStore((s) => s.mapShowCourseVector);
  const vectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);

  const data = useMemo((): FeatureCollection => {
    if (!show) return { type: 'FeatureCollection', features: [] };

    const displayFix = fix ?? lastGoodFix;
    if (!displayFix) return { type: 'FeatureCollection', features: [] };

    const stale = isFixStale(fix);
    const bearing = displayCog(displayFix);
    const geom = buildCourseVectorGeometry(
      {
        latitude: displayFix.latitude,
        longitude: displayFix.longitude,
        speedKn: stale ? 0 : displayFix.speedKn,
        bearingDeg: bearing,
      },
      vectorMinutes,
    );

    if (!geom) return { type: 'FeatureCollection', features: [] };

    const features: Feature[] = [
      {
        type: 'Feature',
        properties: { kind: 'course-wedge', stale },
        geometry: {
          type: 'Polygon',
          coordinates: [geom.wedge],
        } satisfies Polygon,
      },
      {
        type: 'Feature',
        properties: { kind: 'course-vector', stale, lengthNm: geom.lengthNm },
        geometry: {
          type: 'LineString',
          coordinates: geom.line,
        } satisfies LineString,
      },
    ];

    return { type: 'FeatureCollection', features };
  }, [show, vectorMinutes, fix, lastGoodFix]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-course-vector" data={data}>
      <Layer
        id="seacheck-course-wedge-fill"
        type="fill"
        filter={['==', ['get', 'kind'], 'course-wedge']}
        paint={{
          'fill-color': ['case', ['get', 'stale'], VECTOR_STALE, VECTOR_BLUE],
          'fill-opacity': 0.92,
        }}
      />
      <Layer
        id="seacheck-course-wedge-outline"
        type="line"
        filter={['==', ['get', 'kind'], 'course-wedge']}
        paint={{
          'line-color': '#ffffff',
          'line-width': 1.5,
          'line-opacity': 0.95,
        }}
      />
      <Layer
        id="seacheck-course-vector-line"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'course-vector'], ['!', ['get', 'stale']]]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': VECTOR_BLUE,
          'line-width': 3,
          'line-opacity': 0.88,
        }}
      />
      <Layer
        id="seacheck-course-vector-stale"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'course-vector'], ['get', 'stale']]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': VECTOR_STALE,
          'line-width': 3,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2],
        }}
      />
    </GeoJSONSource>
  );
}
