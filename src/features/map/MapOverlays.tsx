import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';

import { normalizeBounds } from '../../lib/map/bounds';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { bearingTrue, destinationPoint, distanceNm, type LonLat } from '../../lib/geo/navigation';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useWaypointStore } from '../../store/waypointStore';
import { laylineBearingsFromMark } from '../../lib/racing/racingGeo';
import { RACING_PACK_V11 } from '../../lib/featureFlags';
import { useSettingsStore } from '../../store/settingsStore';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useTrackStore } from '../../store/trackStore';
import { CourseVectorOverlay } from './CourseVectorOverlay';

type Props = {
  showRangeRings: boolean;
};

function circlePolygon(center: LonLat, radiusNm: number, steps = 64): Polygon {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 * i) / steps;
    const [lon, lat] = destinationPoint(center, bearing, radiusNm);
    coords.push([lon, lat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export function MapOverlays({ showRangeRings }: Props) {
  const fix = useLocationStore((s) => s.fix);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const customBounds = useCustomDownloadStore((s) => {
    const a = s.cornerA;
    const b = s.cornerB;
    if (!a || !b) return null;
    return normalizeBounds(a, b);
  });
  const customCornerA = useCustomDownloadStore((s) => s.cornerA);

  const geojson = useMemo(() => {
    const features: Feature[] = [];

    if (customBounds) {
      const [west, south, east, north] = customBounds;
      features.push({
        type: 'Feature',
        properties: { kind: 'custom-download' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
        },
      });
    }
    if (customCornerA && !customBounds) {
      features.push({
        type: 'Feature',
        properties: { kind: 'custom-corner' },
        geometry: { type: 'Point', coordinates: [customCornerA.longitude, customCornerA.latitude] },
      });
    }

    if (fix) {
      const pos: LonLat = [fix.longitude, fix.latitude];
      if (showRangeRings) {
        for (const r of [0.5, 1, 2]) {
          features.push({
            type: 'Feature',
            properties: { kind: 'range', radiusNm: r },
            geometry: circlePolygon(pos, r),
          });
        }
      }
    }

    if (goToTarget && fix) {
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
  }, [fix, goToTarget, mobTarget, anchorAlarm, showRangeRings, customBounds, customCornerA]);

  return (
    <>
      <CourseVectorOverlay />
      <GeoJSONSource id="seacheck-overlays" data={geojson}>
        <Layer
          id="seacheck-range-fill"
          type="fill"
          filter={['==', ['get', 'kind'], 'range']}
          paint={{ 'fill-color': '#0073ad', 'fill-opacity': 0.06 }}
        />
        <Layer
          id="seacheck-range-line"
          type="line"
          filter={['==', ['get', 'kind'], 'range']}
          paint={{ 'line-color': '#0073ad', 'line-width': 1, 'line-opacity': 0.35, 'line-dasharray': [2, 2] }}
        />
        <Layer
          id="seacheck-goto-line"
          type="line"
          filter={['==', ['get', 'kind'], 'goto-line']}
          paint={{ 'line-color': '#0073ad', 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] }}
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
          id="seacheck-custom-download-fill"
          type="fill"
          filter={['==', ['get', 'kind'], 'custom-download']}
          paint={{ 'fill-color': '#0073ad', 'fill-opacity': 0.15 }}
        />
        <Layer
          id="seacheck-custom-download-line"
          type="line"
          filter={['==', ['get', 'kind'], 'custom-download']}
          paint={{ 'line-color': '#0073ad', 'line-width': 2, 'line-opacity': 0.95 }}
        />
        <Layer
          id="seacheck-custom-corner"
          type="circle"
          filter={['==', ['get', 'kind'], 'custom-corner']}
          paint={{ 'circle-radius': 10, 'circle-color': '#0073ad', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' }}
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
      <StartLineOverlay />
      <LaylineOverlay />
      <PassageOverlay passageId={activePassageId} activeLegIndex={activeLegIndex} />
      <WaypointsOverlay />
      <TrackTrailOverlay />
      <SavedTrackOverlay />
      <StaleFixOverlay />
    </>
  );
}

function StartLineOverlay() {
  const startLine = useNavigationStore((s) => s.startLine);
  const waypoints = useWaypointStore((s) => s.items);

  const data = useMemo(() => {
    if (!startLine) return { type: 'FeatureCollection' as const, features: [] };
    const pinA = waypoints.find((w) => w.id === startLine.pinAWaypointId);
    const pinB = waypoints.find((w) => w.id === startLine.pinBWaypointId);
    if (!pinA || !pinB) return { type: 'FeatureCollection' as const, features: [] };
    const features: Feature[] = [
      {
        type: 'Feature',
        properties: { kind: 'start-line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [pinA.longitude, pinA.latitude],
            [pinB.longitude, pinB.latitude],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { kind: 'start-pin' },
        geometry: { type: 'Point', coordinates: [pinA.longitude, pinA.latitude] },
      },
      {
        type: 'Feature',
        properties: { kind: 'start-pin' },
        geometry: { type: 'Point', coordinates: [pinB.longitude, pinB.latitude] },
      },
    ];
    return { type: 'FeatureCollection' as const, features };
  }, [startLine, waypoints]);

  if (!startLine || data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-start-line" data={data}>
      <Layer
        id="seacheck-start-line-stroke"
        type="line"
        filter={['==', ['get', 'kind'], 'start-line']}
        paint={{ 'line-color': '#2e7d32', 'line-width': 4, 'line-opacity': 0.95, 'line-dasharray': [2, 1.5] }}
      />
      <Layer
        id="seacheck-start-line-pin"
        type="circle"
        filter={['==', ['get', 'kind'], 'start-pin']}
        paint={{ 'circle-radius': 8, 'circle-color': '#2e7d32', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }}
      />
    </GeoJSONSource>
  );
}

function LaylineOverlay() {
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const wind = useSettingsStore((s) => s.raceWindDirectionTrue);
  const tacking = useSettingsStore((s) => s.raceTackingAngleDeg);
  const showLaylines = useSettingsStore((s) => s.raceShowLaylines);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);

  const data = useMemo(() => {
    if (!RACING_PACK_V11 || activityProfileId !== 'sailing-race' || !showLaylines || wind == null || !goToTarget) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    const mark: LonLat = [goToTarget.longitude, goToTarget.latitude];
    const { portDeg, starboardDeg } = laylineBearingsFromMark(wind, tacking);
    const lengthNm = 3;
    const portEnd = destinationPoint(mark, portDeg, lengthNm);
    const starEnd = destinationPoint(mark, starboardDeg, lengthNm);
    const features: Feature[] = [
      {
        type: 'Feature',
        properties: { kind: 'layline-port' },
        geometry: { type: 'LineString', coordinates: [mark, portEnd] },
      },
      {
        type: 'Feature',
        properties: { kind: 'layline-starboard' },
        geometry: { type: 'LineString', coordinates: [mark, starEnd] },
      },
    ];
    return { type: 'FeatureCollection' as const, features };
  }, [activityProfileId, showLaylines, wind, tacking, goToTarget]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-laylines" data={data}>
      <Layer
        id="seacheck-layline-port"
        type="line"
        filter={['==', ['get', 'kind'], 'layline-port']}
        paint={{ 'line-color': '#e65100', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [1.5, 1] }}
      />
      <Layer
        id="seacheck-layline-starboard"
        type="line"
        filter={['==', ['get', 'kind'], 'layline-starboard']}
        paint={{ 'line-color': '#1565c0', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [1.5, 1] }}
      />
    </GeoJSONSource>
  );
}

function PassageOverlay({ passageId, activeLegIndex }: { passageId: string | null; activeLegIndex: number }) {
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
  }, [passageId, passages, getPassageDetail]);

  const data = useMemo(
    () => (waypoints.length >= 2 ? buildPassageGeoJson(waypoints, activeLegIndex) : { type: 'FeatureCollection' as const, features: [] }),
    [waypoints, activeLegIndex],
  );

  if (!passageId || waypoints.length < 2) return null;

  return (
    <GeoJSONSource id="seacheck-passage" data={data}>
      <Layer
        id="seacheck-passage-line"
        type="line"
        filter={['==', ['get', 'kind'], 'passage-leg']}
        paint={{
          'line-color': ['case', ['get', 'active'], '#0073ad', '#486581'],
          'line-width': ['case', ['get', 'active'], 4, 2],
          'line-opacity': 0.9,
        }}
      />
      <Layer
        id="seacheck-passage-wp"
        type="circle"
        filter={['==', ['get', 'kind'], 'passage-wp']}
        paint={{ 'circle-radius': 6, 'circle-color': '#0073ad', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }}
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
    features.push({
      type: 'Feature',
      properties: { kind: 'passage-leg', active: i - 1 === activeLegIndex },
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
      properties: { kind: 'passage-wp' },
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

  const data = useMemo(() => {
    const features: Feature[] = waypoints.map((wp) => ({
      type: 'Feature',
      properties: { kind: 'saved-wp', wpType: wp.type, selected: wp.id === goToId },
      geometry: { type: 'Point', coordinates: [wp.longitude, wp.latitude] },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [waypoints, goToId]);

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

function StaleFixOverlay() {
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const stale = isFixStale(fix);
  const show = stale && lastGoodFix;

  const data = useMemo(() => {
    if (!show || !lastGoodFix) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { kind: 'stale-fix' },
          geometry: { type: 'Point' as const, coordinates: [lastGoodFix.longitude, lastGoodFix.latitude] },
        },
      ],
    };
  }, [show, lastGoodFix]);

  if (data.features.length === 0) return null;

  return (
    <GeoJSONSource id="seacheck-stale-fix" data={data}>
      <Layer
        id="seacheck-stale-fix-point"
        type="circle"
        filter={['==', ['get', 'kind'], 'stale-fix']}
        paint={{ 'circle-radius': 12, 'circle-color': '#486581', 'circle-opacity': 0.45, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }}
      />
    </GeoJSONSource>
  );
}
