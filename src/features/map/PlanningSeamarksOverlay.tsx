import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import type { Feature, FeatureCollection } from 'geojson';

import { approxViewportBounds } from '../../lib/map/viewportBounds';
import { queryPlanningSeamarksInBounds, type PlanningSeamarkFeature } from '../../lib/seamarks/queryPlanningSeamarks';
import { SEAMARK_PLANNING_COLORS } from '../../lib/seamarks/seamarkCategories';
import type { SeamarkPlanningConfig } from '../../lib/settings/seamarkSettings';
import type { PressEventWithFeatures } from '@maplibre/maplibre-react-native';

type Props = {
  /** When set, use fixed bounds instead of centre/zoom (e.g. passage preview). */
  bounds?: [number, number, number, number] | null;
  centerLatitude: number;
  centerLongitude: number;
  zoom: number | null;
  config: SeamarkPlanningConfig;
  /** Show name labels when zoom is at least this value. */
  labelFromZoom?: number;
  /** When set, taps on planning marks call back instead of bubbling to the map. */
  onMarkPress?: (mark: PlanningSeamarkFeature) => void;
};

export function PlanningSeamarksOverlay({
  bounds,
  centerLatitude,
  centerLongitude,
  zoom,
  config,
  labelFromZoom = 11,
  onMarkPress,
}: Props) {
  const [features, setFeatures] = useState<PlanningSeamarkFeature[]>([]);

  const queryBounds = useMemo(() => {
    if (bounds) return bounds;
    if (zoom == null) return null;
    return approxViewportBounds(centerLatitude, centerLongitude, zoom);
  }, [bounds, centerLatitude, centerLongitude, zoom]);

  useEffect(() => {
    if (!config.enabled || !queryBounds || zoom == null) {
      setFeatures([]);
      return;
    }
    let cancelled = false;
    void queryPlanningSeamarksInBounds(queryBounds, config, zoom).then((rows) => {
      if (!cancelled) setFeatures(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [config, queryBounds, zoom]);

  const geojson = useMemo(() => buildPlanningGeoJson(features, zoom, labelFromZoom), [features, zoom, labelFromZoom]);

  const featureById = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);

  function handleSourcePress(event: NativeSyntheticEvent<PressEventWithFeatures>) {
    if (!onMarkPress) return;
    const feature = event.nativeEvent.features?.find((f) => f.properties?.kind === 'planning-seamark');
    const id = feature?.properties?.id;
    if (typeof id !== 'string') return;
    const mark = featureById.get(id);
    if (!mark) return;
    event.stopPropagation?.();
    onMarkPress(mark);
  }

  if (!config.enabled || geojson.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-planning-seamarks" data={geojson} onPress={onMarkPress ? handleSourcePress : undefined}>
      <Layer
        id="seacheck-planning-seamark-point"
        type="circle"
        filter={['==', ['get', 'kind'], 'planning-seamark']}
        style={{
          circleRadius: ['match', ['get', 'category'], 'harbour', 7, 'anchorage', 6, 'hazard', 6, 5],
          circleColor: [
            'match',
            ['get', 'category'],
            'harbour',
            SEAMARK_PLANNING_COLORS.harbour,
            'anchorage',
            SEAMARK_PLANNING_COLORS.anchorage,
            'navigation',
            SEAMARK_PLANNING_COLORS.navigation,
            SEAMARK_PLANNING_COLORS.hazard,
          ],
          circleStrokeWidth: 2,
          circleStrokeColor: '#ffffff',
          circleOpacity: 0.95,
        }}
      />
      <Layer
        id="seacheck-planning-seamark-label"
        type="symbol"
        filter={['==', ['get', 'kind'], 'planning-seamark-label']}
        style={{
          textField: ['get', 'label'],
          textSize: 11,
          textOffset: [0, 1.1],
          textColor: '#1a1a1a',
          textHaloColor: '#ffffff',
          textHaloWidth: 1.5,
          textAllowOverlap: false,
          textIgnorePlacement: false,
        }}
      />
    </GeoJSONSource>
  );
}

function buildPlanningGeoJson(
  features: PlanningSeamarkFeature[],
  zoom: number | null,
  labelFromZoom: number,
): FeatureCollection {
  const showLabels = zoom != null && zoom >= labelFromZoom;
  const out: Feature[] = [];

  for (const f of features) {
    out.push({
      type: 'Feature',
      properties: { kind: 'planning-seamark', id: f.id, category: f.category, name: f.name },
      geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
    });
    if (showLabels && f.name) {
      out.push({
        type: 'Feature',
        properties: { kind: 'planning-seamark-label', label: f.name },
        geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
      });
    }
  }

  return { type: 'FeatureCollection', features: out };
}
