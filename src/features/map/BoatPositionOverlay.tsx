import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

import {
  buildBoatIconPolygon,
  buildPositionDiamondPolygon,
  buildPositionDotPolygon,
} from '../../lib/geo/boatIcon';
import { resolveBoatHeadingDeg } from '../../lib/geo/cog';
import {
  MAP_BOAT_FILL,
  MAP_BOAT_OUTLINE,
  MAP_BOAT_STALE,
} from '../../lib/map/mapChartColors';
import { isFixStale, useLocationStore, useMapDisplayFix } from '../../services/locationService';

/**
 * Boat-shaped position marker with optional GPS accuracy ring.
 * Heading/COG rotation matches instruments and course vector.
 * Diamond fallback when direction is unknown — distinct from the boat shape.
 */
export function BoatPositionOverlay() {
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const mapDisplayFix = useMapDisplayFix();

  const data = useMemo((): FeatureCollection => {
    const displayFix = mapDisplayFix ?? fix ?? lastGoodFix;
    if (!displayFix) return { type: 'FeatureCollection', features: [] };

    const stale = isFixStale(fix);
    const center: [number, number] = [displayFix.longitude, displayFix.latitude];
    const heading = resolveBoatHeadingDeg(displayFix);
    const features: Feature[] = [];

    const accuracyM =
      !stale && displayFix.accuracyM != null && displayFix.accuracyM > 0 ? displayFix.accuracyM : null;
    if (accuracyM != null) {
      features.push({
        type: 'Feature',
        properties: { kind: 'accuracy' },
        geometry: {
          type: 'Polygon',
          coordinates: [buildPositionDotPolygon(center, Math.max(0.008, accuracyM / 1852))],
        } satisfies Polygon,
      });
    }

    if (heading != null) {
      features.push({
        type: 'Feature',
        properties: { kind: 'boat', stale, heading: Math.round(heading) },
        geometry: {
          type: 'Polygon',
          coordinates: [buildBoatIconPolygon(center, heading)],
        } satisfies Polygon,
      });
    } else {
      features.push({
        type: 'Feature',
        properties: { kind: 'position-marker', stale },
        geometry: {
          type: 'Polygon',
          coordinates: [buildPositionDiamondPolygon(center)],
        } satisfies Polygon,
      });
    }

    return { type: 'FeatureCollection', features };
  }, [fix, lastGoodFix, mapDisplayFix]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-boat-position" data={data}>
      <Layer
        id="seacheck-boat-accuracy"
        type="fill"
        filter={['==', ['get', 'kind'], 'accuracy']}
        paint={{
          'fill-color': MAP_BOAT_FILL,
          'fill-opacity': 0.14,
        }}
      />
      <Layer
        id="seacheck-boat-outline"
        type="line"
        filter={['in', ['get', 'kind'], ['literal', ['boat', 'position-marker']]]}
        paint={{
          'line-color': MAP_BOAT_OUTLINE,
          'line-width': 3,
          'line-opacity': 0.98,
        }}
      />
      <Layer
        id="seacheck-boat-fill"
        type="fill"
        filter={['==', ['get', 'kind'], 'boat']}
        paint={{
          'fill-color': ['case', ['get', 'stale'], MAP_BOAT_STALE, MAP_BOAT_FILL],
          'fill-opacity': 0.96,
        }}
      />
      <Layer
        id="seacheck-position-marker-fill"
        type="fill"
        filter={['==', ['get', 'kind'], 'position-marker']}
        paint={{
          'fill-color': ['case', ['get', 'stale'], MAP_BOAT_STALE, MAP_BOAT_FILL],
          'fill-opacity': 0.96,
        }}
      />
    </GeoJSONSource>
  );
}
