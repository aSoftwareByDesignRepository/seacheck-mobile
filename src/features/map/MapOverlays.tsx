import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';

import { bearingTrue, destinationPoint, distanceNm, type LonLat } from '../../lib/geo/navigation';
import { formatBearing, magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatGotoNavLabel, legMidpoint } from '../../lib/geo/pathDistance';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useSettingsStore } from '../../store/settingsStore';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useTrackStore } from '../../store/trackStore';
import { mobWaypointsOnMap } from '../../lib/map/mapVisibleWaypoints';

function circlePolygon(center: LonLat, radiusNm: number, steps = 64): Polygon {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 * i) / steps;
    const [lon, lat] = destinationPoint(center, bearing, radiusNm);
    coords.push([lon, lat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

type Props = {
  /**
   * Passage planning mode — strip the chart to just the passage being edited.
   * Hides go-to, MOB, anchor, MOB marks and track trails so the navigator can
   * place passage waypoints without competing overlays.
   */
  planningMode?: boolean;
  /** Highlight the selected passage waypoint while planning. */
  planningSelectedWaypointId?: string | null;
};

export function MapOverlays({ planningMode = false, planningSelectedWaypointId = null }: Props) {
  const fix = useLocationStore((s) => s.fix);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const mapShowPassageRouteLines = useSettingsStore((s) => s.mapShowPassageRouteLines);
  const planningPassageId = usePassageMapPlanningStore((s) => s.passageId);
  const planningRevision = usePassageMapPlanningStore((s) => s.revision);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);

  const geojson = useMemo(() => {
    const features: Feature[] = [];

    if (goToTarget && fix && !isFixStale(fix) && !activePassageId) {
      const line: LineString = {
        type: 'LineString',
        coordinates: [
          [fix.longitude, fix.latitude],
          [goToTarget.longitude, goToTarget.latitude],
        ],
      };
      features.push({
        type: 'Feature',
        properties: { kind: 'goto-line' },
        geometry: line,
      });
      const from: LonLat = [fix.longitude, fix.latitude];
      const to: LonLat = [goToTarget.longitude, goToTarget.latitude];
      const { bearingDeg, distanceNm: distNm } = navInfoToTarget(from, to);
      const formatted = formatBearing(bearingDeg, bearingReference, magneticDeclinationDeg(fix.latitude, fix.longitude));
      features.push({
        type: 'Feature',
        properties: {
          kind: 'goto-label',
          label: formatGotoNavLabel(formatted.value, formatted.suffix, distNm, distanceUnit),
        },
        geometry: {
          type: 'Point',
          coordinates: legMidpoint(
            { latitude: fix.latitude, longitude: fix.longitude },
            { latitude: goToTarget.latitude, longitude: goToTarget.longitude },
          ),
        },
      });
      const pt: Point = {
        type: 'Point',
        coordinates: [goToTarget.longitude, goToTarget.latitude],
      };
      features.push({
        type: 'Feature',
        properties: { kind: goToTarget.kind === 'mob' ? 'mob' : 'goto' },
        geometry: pt,
      });
    }

    if (mobTarget && mobTarget.id !== goToTarget?.id) {
      features.push({
        type: 'Feature',
        properties: { kind: 'mob' },
        geometry: { type: 'Point', coordinates: [mobTarget.longitude, mobTarget.latitude] },
      });
    }

    if (anchorAlarm?.active) {
      features.push({
        type: 'Feature',
        properties: { kind: 'anchor', triggered: anchorAlarm.triggered },
        geometry: circlePolygon([anchorAlarm.longitude, anchorAlarm.latitude], anchorAlarm.radiusNm),
      });
      features.push({
        type: 'Feature',
        properties: { kind: 'anchor-center' },
        geometry: { type: 'Point', coordinates: [anchorAlarm.longitude, anchorAlarm.latitude] },
      });
    }

    return { type: 'FeatureCollection', features } satisfies FeatureCollection;
  }, [fix, goToTarget, mobTarget, anchorAlarm, bearingReference, distanceUnit, activePassageId]);

  if (planningMode) {
    return planningPassageId ? (
      <PassagePlanningOverlay
        passageId={planningPassageId}
        revision={planningRevision}
        selectedWaypointId={planningSelectedWaypointId}
      />
    ) : null;
  }

  return (
    <>
      <GeoJSONSource id="seacheck-overlays" data={geojson}>
        <Layer
          id="seacheck-goto-line"
          type="line"
          filter={['==', ['get', 'kind'], 'goto-line']}
          paint={{ 'line-color': '#0073ad', 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] }}
        />
        <Layer
          id="seacheck-goto-label"
          type="symbol"
          filter={['==', ['get', 'kind'], 'goto-label']}
          style={{
            textField: ['get', 'label'],
            textSize: 13,
            textColor: '#003d5c',
            textHaloColor: '#ffffff',
            textHaloWidth: 2,
          }}
        />
        <Layer
          id="seacheck-anchor-fill"
          type="fill"
          filter={['==', ['get', 'kind'], 'anchor']}
          paint={{
            'fill-color': ['case', ['get', 'triggered'], '#ba1b1b', '#0d7a4a'],
            'fill-opacity': 0.12,
          }}
        />
        <Layer
          id="seacheck-anchor-line"
          type="line"
          filter={['==', ['get', 'kind'], 'anchor']}
          paint={{
            'line-color': ['case', ['get', 'triggered'], '#ba1b1b', '#0d7a4a'],
            'line-width': 2,
            'line-opacity': 0.9,
          }}
        />
        <Layer
          id="seacheck-goto-point"
          type="circle"
          filter={['in', ['get', 'kind'], ['literal', ['goto', 'mob', 'anchor-center']]]}
          paint={{
            'circle-radius': 8,
            'circle-color': ['match', ['get', 'kind'], 'mob', '#ba1b1b', 'anchor-center', '#0d7a4a', '#0073ad'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </GeoJSONSource>
      {mapShowPassageRouteLines && activePassageId ? (
        <PassageOverlay
          passageId={activePassageId}
          activeLegIndex={activeLegIndex}
          refreshRevision={planningPassageId === activePassageId ? planningRevision : 0}
        />
      ) : null}
      {planningPassageId && planningPassageId !== activePassageId ? (
        <PassagePlanningOverlay passageId={planningPassageId} revision={planningRevision} />
      ) : null}
      {planningPassageId && planningPassageId === activePassageId && !mapShowPassageRouteLines ? (
        <PassagePlanningOverlay passageId={planningPassageId} revision={planningRevision} showRouteLines={false} />
      ) : null}
      <WaypointsOverlay />
      <TrackTrailOverlay />
      <SavedTrackOverlay />
    </>
  );
}

function PassagePlanningOverlay({
  passageId,
  revision,
  showRouteLines = true,
  selectedWaypointId = null,
}: {
  passageId: string;
  revision: number;
  showRouteLines?: boolean;
  selectedWaypointId?: string | null;
}) {
  const routeRevision = usePassageStore((s) => s.routeRevision);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const [waypoints, setWaypoints] = useState<{ id: string; longitude: number; latitude: number }[]>([]);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const seq = ++requestSeqRef.current;
    void getPassageDetail(passageId).then((detail) => {
      if (seq !== requestSeqRef.current) return;
      setWaypoints(detail?.waypoints ?? []);
    });
  }, [passageId, revision, routeRevision, getPassageDetail]);

  if (waypoints.length < 1) return null;

  const lineData =
    waypoints.length >= 2
      ? buildPlanningPassageGeoJson(waypoints, selectedWaypointId)
      : {
          type: 'FeatureCollection' as const,
          features: waypoints.map((wp) => ({
            type: 'Feature' as const,
            properties: { kind: 'planning-wp', selected: wp.id === selectedWaypointId },
            geometry: { type: 'Point' as const, coordinates: [wp.longitude, wp.latitude] },
          })),
        };

  const sourceKey = `${passageId}-${revision}-${routeRevision}-${selectedWaypointId ?? 'none'}-${waypoints.map((wp) => wp.id).join(',')}`;

  return (
    <GeoJSONSource key={sourceKey} id="seacheck-passage-planning" data={lineData}>
      {waypoints.length >= 2 && showRouteLines ? (
        <Layer
          id="seacheck-passage-planning-line"
          type="line"
          filter={['==', ['get', 'kind'], 'planning-leg']}
          paint={{ 'line-color': '#e65100', 'line-width': 3, 'line-opacity': 0.95, 'line-dasharray': [2, 1.5] }}
        />
      ) : null}
      <Layer
        id="seacheck-passage-planning-wp"
        type="circle"
        filter={['==', ['get', 'kind'], 'planning-wp']}
        paint={{
          'circle-radius': ['case', ['get', 'selected'], 10, 7],
          'circle-color': ['case', ['get', 'selected'], '#0073ad', '#e65100'],
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
          'circle-stroke-color': '#fff',
        }}
      />
    </GeoJSONSource>
  );
}

function PassageOverlay({
  passageId,
  activeLegIndex,
  refreshRevision = 0,
}: {
  passageId: string | null;
  activeLegIndex: number;
  refreshRevision?: number;
}) {
  const passages = usePassageStore((s) => s.passages);
  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const [waypoints, setWaypoints] = useState<{ longitude: number; latitude: number }[]>([]);

  useEffect(() => {
    if (!passageId) {
      setWaypoints([]);
      return;
    }
    void getPassageDetail(passageId).then((detail) => {
      setWaypoints(detail?.waypoints ?? []);
    });
  }, [passageId, passages, getPassageDetail, refreshRevision]);

  const data = useMemo(
    () => (waypoints.length >= 2 ? buildPassageGeoJson(waypoints, activeLegIndex) : { type: 'FeatureCollection' as const, features: [] }),
    [waypoints, activeLegIndex],
  );

  if (!passageId || waypoints.length < 2) return null;

  return (
    <GeoJSONSource id="seacheck-passage" data={data}>
      <Layer
        id="seacheck-passage-line-completed"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'passage-leg'], ['==', ['get', 'phase'], 'completed']]}
        paint={{ 'line-color': '#64748b', 'line-width': 2, 'line-opacity': 0.35 }}
      />
      <Layer
        id="seacheck-passage-line-upcoming"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'passage-leg'], ['==', ['get', 'phase'], 'upcoming']]}
        paint={{
          'line-color': '#7eb8d4',
          'line-width': 2.5,
          'line-opacity': 0.55,
        }}
      />
      <Layer
        id="seacheck-passage-line-active-casing"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'passage-leg'], ['==', ['get', 'phase'], 'active']]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.95 }}
      />
      <Layer
        id="seacheck-passage-line-active"
        type="line"
        filter={['all', ['==', ['get', 'kind'], 'passage-leg'], ['==', ['get', 'phase'], 'active']]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#0073ad', 'line-width': 5, 'line-opacity': 1 }}
      />
      <Layer
        id="seacheck-passage-wp-passed"
        type="circle"
        filter={['all', ['==', ['get', 'kind'], 'passage-wp'], ['==', ['get', 'phase'], 'passed']]}
        paint={{
          'circle-radius': 4,
          'circle-color': '#64748b',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.6,
        }}
      />
      <Layer
        id="seacheck-passage-wp-upcoming"
        type="circle"
        filter={['all', ['==', ['get', 'kind'], 'passage-wp'], ['==', ['get', 'phase'], 'upcoming']]}
        paint={{
          'circle-radius': ['case', ['get', 'isNext'], 9, 5],
          'circle-color': ['case', ['get', 'isNext'], '#0073ad', '#7eb8d4'],
          'circle-stroke-width': ['case', ['get', 'isNext'], 3, 2],
          'circle-stroke-color': '#fff',
        }}
      />
    </GeoJSONSource>
  );
}

export function buildPassageGeoJson(
  waypoints: { longitude: number; latitude: number }[],
  activeLegIndex: number,
): FeatureCollection {
  const features: Feature[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const legIndex = i - 1;
    const phase = legIndex < activeLegIndex ? 'completed' : legIndex === activeLegIndex ? 'active' : 'upcoming';
    features.push({
      type: 'Feature',
      properties: { kind: 'passage-leg', phase },
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
      },
    });
  }
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const phase = i <= activeLegIndex ? 'passed' : 'upcoming';
    const isNext = i === activeLegIndex + 1;
    features.push({
      type: 'Feature',
      properties: { kind: 'passage-wp', phase, isNext },
      geometry: { type: 'Point', coordinates: [wp.longitude, wp.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildPlanningPassageGeoJson(
  waypoints: { id?: string; longitude: number; latitude: number }[],
  selectedWaypointId: string | null = null,
): FeatureCollection {
  const features: Feature[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    features.push({
      type: 'Feature',
      properties: { kind: 'planning-leg' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
      },
    });
  }
  for (const wp of waypoints) {
    features.push({
      type: 'Feature',
      properties: { kind: 'planning-wp', selected: wp.id != null && wp.id === selectedWaypointId },
      geometry: { type: 'Point', coordinates: [wp.longitude, wp.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function navInfoToTarget(
  from: LonLat,
  to: LonLat,
): { bearingDeg: number; distanceNm: number } {
  return {
    bearingDeg: bearingTrue(from, to),
    distanceNm: distanceNm(from, to),
  };
}

const WP_COLORS: Record<string, string> = {
  harbour: '#0073ad',
  anchorage: '#0d7a4a',
  mark: '#e65100',
  hazard: '#ba1b1b',
  mob: '#ba1b1b',
  generic: '#486581',
};

function WaypointsOverlay() {
  const waypoints = useWaypointStore((s) => s.items);
  const goToId = useNavigationStore((s) => s.goToTarget?.id);
  const mobMarks = useMemo(() => mobWaypointsOnMap(waypoints), [waypoints]);

  const data = useMemo(() => {
    const features: Feature[] = mobMarks.map((wp) => ({
      type: 'Feature',
      properties: { kind: 'saved-wp', wpType: wp.type, selected: wp.id === goToId },
      geometry: { type: 'Point', coordinates: [wp.longitude, wp.latitude] },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [mobMarks, goToId]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-waypoints" data={data}>
      <Layer
        id="seacheck-saved-wp"
        type="circle"
        filter={['==', ['get', 'kind'], 'saved-wp']}
        paint={{
          'circle-radius': ['case', ['get', 'selected'], 10, 7],
          'circle-color': [
            'match',
            ['get', 'wpType'],
            'harbour', WP_COLORS.harbour,
            'anchorage', WP_COLORS.anchorage,
            'mark', WP_COLORS.mark,
            'hazard', WP_COLORS.hazard,
            'mob', WP_COLORS.mob,
            WP_COLORS.generic,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        }}
      />
    </GeoJSONSource>
  );
}

function SavedTrackOverlay() {
  const mapPreviewLine = useTrackStore((s) => s.mapPreviewLine);
  const mapPreviewTrackId = useTrackStore((s) => s.mapPreviewTrackId);

  const data = useMemo(() => {
    if (!mapPreviewTrackId || mapPreviewLine.length < 2) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { kind: 'saved-track' },
          geometry: { type: 'LineString' as const, coordinates: mapPreviewLine },
        },
      ],
    };
  }, [mapPreviewLine, mapPreviewTrackId]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-saved-track" data={data}>
      <Layer
        id="seacheck-saved-track-line"
        type="line"
        filter={['==', ['get', 'kind'], 'saved-track']}
        paint={{ 'line-color': '#00838f', 'line-width': 4, 'line-opacity': 0.85 }}
      />
    </GeoJSONSource>
  );
}

function TrackTrailOverlay() {
  const liveTrail = useTrackStore((s) => s.liveTrail);
  const recording = useTrackStore((s) => s.recordingTrackId);

  const data = useMemo(() => {
    if (!recording || liveTrail.length < 2) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { kind: 'track-trail' },
          geometry: { type: 'LineString' as const, coordinates: liveTrail },
        },
      ],
    };
  }, [liveTrail, recording]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-track-trail" data={data}>
      <Layer
        id="seacheck-track-trail-line"
        type="line"
        filter={['==', ['get', 'kind'], 'track-trail']}
        paint={{ 'line-color': '#7b1fa2', 'line-width': 3, 'line-opacity': 0.75 }}
      />
    </GeoJSONSource>
  );
}
