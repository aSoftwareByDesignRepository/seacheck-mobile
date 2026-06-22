import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { bearingTrue, destinationPoint, distanceNm, type LonLat } from '../geo/navigation';

export type CoveragePack = {
  id: string;
  label: string;
  bounds: LngLatBounds;
  ready: boolean;
};

export type LegCoverage = {
  legIndex: number;
  fromName: string;
  toName: string;
  covered: boolean;
  coveringPackLabels: string[];
};

export type PassageCoverageReport = {
  fullyCovered: boolean;
  readyPackCount: number;
  uncoveredLegCount: number;
  legs: LegCoverage[];
};

const BUFFER_NM = 0.5;

function pointInBounds(bounds: LngLatBounds, lat: number, lon: number): boolean {
  const [west, south, east, north] = bounds;
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

function sampleLegPoints(from: LonLat, to: LonLat, samples = 5): LonLat[] {
  const dist = distanceNm(from, to);
  if (dist < 0.01) return [from, to];
  const brg = bearingTrue(from, to);
  const points: LonLat[] = [from];
  for (let i = 1; i < samples - 1; i++) {
    points.push(destinationPoint(from, brg, dist * (i / (samples - 1))));
  }
  points.push(to);
  return points;
}

function expandedBounds(bounds: LngLatBounds, bufferNm: number): LngLatBounds {
  const [west, south, east, north] = bounds;
  const midLat = (south + north) / 2;
  const dLat = bufferNm / 60;
  const dLon = bufferNm / (60 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return [west - dLon, south - dLat, east + dLon, north + dLat];
}

function pointCoveredByPacks(lat: number, lon: number, packs: CoveragePack[]): string[] {
  const hits: string[] = [];
  for (const pack of packs) {
    if (!pack.ready) continue;
    const expanded = expandedBounds(pack.bounds, BUFFER_NM);
    if (pointInBounds(expanded, lat, lon)) hits.push(pack.label);
  }
  return hits;
}

export function assessPassageCoverage(
  waypoints: { name: string; latitude: number; longitude: number }[],
  packs: CoveragePack[],
): PassageCoverageReport {
  const readyPacks = packs.filter((p) => p.ready);
  if (waypoints.length < 2) {
    return { fullyCovered: false, readyPackCount: readyPacks.length, uncoveredLegCount: 0, legs: [] };
  }

  const legs: LegCoverage[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const samples = sampleLegPoints([from.longitude, from.latitude], [to.longitude, to.latitude]);
    const covering = new Set<string>();
    let allCovered = samples.length > 0;
    for (const [lon, lat] of samples) {
      const hits = pointCoveredByPacks(lat, lon, readyPacks);
      if (hits.length === 0) {
        allCovered = false;
        break;
      }
      for (const h of hits) covering.add(h);
    }
    legs.push({
      legIndex: i,
      fromName: from.name,
      toName: to.name,
      covered: allCovered && readyPacks.length > 0,
      coveringPackLabels: [...covering],
    });
  }

  const uncoveredLegCount = legs.filter((l) => !l.covered).length;
  return {
    fullyCovered: uncoveredLegCount === 0 && legs.length > 0,
    readyPackCount: readyPacks.length,
    uncoveredLegCount,
    legs,
  };
}

export function buildCoveragePacks(
  regions: Record<string, { state: string; displayName?: string; custom?: boolean }>,
  regionDefs: { id: string; nameKey: string; bounds: LngLatBounds }[],
  customEntries: Record<string, { name?: string; bounds?: LngLatBounds }>,
  labelForKey: (key: string) => string,
): CoveragePack[] {
  const packs: CoveragePack[] = [];
  for (const def of regionDefs) {
    packs.push({
      id: def.id,
      label: labelForKey(def.nameKey),
      bounds: def.bounds,
      ready: regions[def.id]?.state === 'ready',
    });
  }
  for (const [id, entry] of Object.entries(customEntries)) {
    if (!entry.bounds) continue;
    packs.push({
      id,
      label: entry.name ?? id,
      bounds: entry.bounds,
      ready: regions[id]?.state === 'ready',
    });
  }
  return packs;
}
