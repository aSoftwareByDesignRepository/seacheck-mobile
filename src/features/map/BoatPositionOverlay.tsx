import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import type { Feature, Polygon } from 'geojson';

import {
  BOAT_ICON_LENGTH_NM,
  buildBoatIconPolygon,
  buildPositionDiamondPolygon,
  buildPositionDotPolygon,
} from '../../lib/geo/boatIcon';
import { resolveBoatHeadingDeg } from '../../lib/geo/cog';
import {
  BOAT_ICON_TARGET_LENGTH_PX,
  chartSymbolOutlineWidth,
  chartSymbolScaleForZoom,
  DIAMOND_TARGET_RADIUS_PX,
  resolveChartZoom,
} from '../../lib/map/chartSymbolScale';
import {
  MAP_BOAT_FILL,
  MAP_BOAT_OUTLINE,
  MAP_BOAT_STALE,
} from '../../lib/map/mapChartColors';
import { isFixStale, useLocationStore, useMapDisplayFix } from '../../services/locationService';

const DIAMOND_BASE_RADIUS_NM = 0.014;

type Props = {
  /** Live chart zoom — symbols scale so the boat stays visible when zoomed out. */
  mapZoom: number | null;
  fallbackZoom?: number;
};

/**
 * Boat-shaped position marker with optional GPS accuracy ring.
 * Heading/COG rotation matches instruments and course vector.
 * Diamond fallback when direction is unknown — distinct from the boat shape.
 */
export function BoatPositionOverlay({ mapZoom, fallbackZoom = 13 }: Props) {
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const mapDisplayFix = useMapDisplayFix();

  const { data, outlineWidth } = useMemo(() => {
    const displayFix = mapDisplayFix ?? fix ?? lastGoodFix;
    if (!displayFix) {
      return { data: { type: 'FeatureCollection' as const, features: [] }, outlineWidth: 3 };
    }

    const stale = isFixStale(fix);
    const center: [number, number] = [displayFix.longitude, displayFix.latitude];
    const heading = resolveBoatHeadingDeg(displayFix);
    const zoom = resolveChartZoom(mapZoom, fallbackZoom);
    const boatScale = chartSymbolScaleForZoom(
      zoom,
      displayFix.latitude,
      BOAT_ICON_TARGET_LENGTH_PX,
      BOAT_ICON_LENGTH_NM,
    );
    const diamondScale = chartSymbolScaleForZoom(
      zoom,
      displayFix.latitude,
      DIAMOND_TARGET_RADIUS_PX * 2,
      DIAMOND_BASE_RADIUS_NM * 2,
    );
    const lineWidth = chartSymbolOutlineWidth(Math.max(boatScale, diamondScale));
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
          coordinates: [buildBoatIconPolygon(center, heading, boatScale)],
        } satisfies Polygon,
      });
    } else {
      features.push({
        type: 'Feature',
        properties: { kind: 'position-marker', stale },
        geometry: {
          type: 'Polygon',
          coordinates: [buildPositionDiamondPolygon(center, DIAMOND_BASE_RADIUS_NM, diamondScale)],
        } satisfies Polygon,
      });
    }

    return { data: { type: 'FeatureCollection' as const, features }, outlineWidth: lineWidth };
  }, [fix, lastGoodFix, mapDisplayFix, mapZoom, fallbackZoom]);

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
          'line-width': outlineWidth,
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
