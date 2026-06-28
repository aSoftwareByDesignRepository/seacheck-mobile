import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { bearingTrue, destinationPoint, distanceNm, type LonLat } from '../geo/navigation';
import { expandLngLatBounds, pointInLngLatBounds } from './bounds';

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

export type PackSuggestionCandidate = {
  id: string;
  bounds: LngLatBounds;
  priority: 'P0' | 'P1' | 'P2';
};

export type PassagePackSuggestion = {
  packId: string;
  coversLegCount: number;
};

export type SuggestPacksResult = {
  suggestions: PassagePackSuggestion[];
  uncoveredLegCountAfterSuggestions: number;
  needsCustomArea: boolean;
};

const BUFFER_NM = 0.5;
const PRIORITY_RANK: Record<PackSuggestionCandidate['priority'], number> = { P0: 0, P1: 1, P2: 2 };

export type PassageLegSample = {
  legIndex: number;
  fromName: string;
  toName: string;
  samples: LonLat[];
};

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

function pointCoveredByPacks(lat: number, lon: number, packs: CoveragePack[]): string[] {
  const hits: string[] = [];
  for (const pack of packs) {
    if (!pack.ready) continue;
    const expanded = expandLngLatBounds(pack.bounds, BUFFER_NM);
    if (pointInLngLatBounds(expanded, lat, lon)) hits.push(pack.label);
  }
  return hits;
}

/** Public helper — whether lat/lon falls inside any ready offline pack (with buffer). */
export function pointCoveredByReadyPacks(lat: number, lon: number, packs: CoveragePack[]): string[] {
  return pointCoveredByPacks(lat, lon, packs);
}

export function buildPassageLegSamples(
  waypoints: { name: string; latitude: number; longitude: number }[],
): PassageLegSample[] {
  const legs: PassageLegSample[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    legs.push({
      legIndex: i,
      fromName: from.name,
      toName: to.name,
      samples: sampleLegPoints([from.longitude, from.latitude], [to.longitude, to.latitude]),
    });
  }
  return legs;
}

/** Greedy corridor-pack set cover for legs not yet covered by ready offline packs. */
export function suggestPacksForPassage(
  waypoints: { name: string; latitude: number; longitude: number }[],
  candidates: PackSuggestionCandidate[],
  readyPacks: CoveragePack[],
  readyIds: Set<string>,
): SuggestPacksResult {
  const legs = buildPassageLegSamples(waypoints);
  if (legs.length === 0) {
    return { suggestions: [], uncoveredLegCountAfterSuggestions: 0, needsCustomArea: false };
  }

  type SampleRef = { legIndex: number; lat: number; lon: number };

  const uncoveredSamples: SampleRef[] = [];
  for (const leg of legs) {
    for (const [lon, lat] of leg.samples) {
      if (pointCoveredByPacks(lat, lon, readyPacks).length === 0) {
        uncoveredSamples.push({ legIndex: leg.legIndex, lat, lon });
      }
    }
  }

  if (uncoveredSamples.length === 0) {
    return { suggestions: [], uncoveredLegCountAfterSuggestions: 0, needsCustomArea: false };
  }

  const available = candidates.filter((c) => !readyIds.has(c.id));
  const suggestions: PassagePackSuggestion[] = [];
  const chosen = new Set<string>();
  let remaining = [...uncoveredSamples];

  while (remaining.length > 0) {
    let best: { id: string; count: number; priority: number } | null = null;
    for (const pack of available) {
      if (chosen.has(pack.id)) continue;
      let count = 0;
      for (const sample of remaining) {
        if (pointInLngLatBounds(expandLngLatBounds(pack.bounds, BUFFER_NM), sample.lat, sample.lon)) count++;
      }
      if (count === 0) continue;
      const rank = PRIORITY_RANK[pack.priority];
      if (!best || count > best.count || (count === best.count && rank < best.priority)) {
        best = { id: pack.id, count, priority: rank };
      }
    }
    if (!best) break;

    const packDef = available.find((p) => p.id === best!.id);
    if (!packDef) break;

    chosen.add(best.id);

    let legsHelped = 0;
    for (const leg of legs) {
      const legHasGap = leg.samples.some(
        ([lon, lat]) => pointCoveredByPacks(lat, lon, readyPacks).length === 0,
      );
      if (!legHasGap) continue;
      const packHelps = leg.samples.some(
        ([lon, lat]) =>
          pointCoveredByPacks(lat, lon, readyPacks).length === 0 &&
          pointInLngLatBounds(expandLngLatBounds(packDef.bounds, BUFFER_NM), lat, lon),
      );
      if (packHelps) legsHelped++;
    }

    suggestions.push({ packId: best.id, coversLegCount: Math.max(1, legsHelped) });
    remaining = remaining.filter(
      (sample) => !pointInLngLatBounds(expandLngLatBounds(packDef.bounds, BUFFER_NM), sample.lat, sample.lon),
    );
  }

  const uncoveredLegIndices = new Set<number>();
  for (const sample of remaining) uncoveredLegIndices.add(sample.legIndex);

  return {
    suggestions,
    uncoveredLegCountAfterSuggestions: uncoveredLegIndices.size,
    needsCustomArea: remaining.length > 0,
  };
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
  legacyDefs: { id: string; nameKey: string; bounds: LngLatBounds }[] = [],
): CoveragePack[] {
  const packs: CoveragePack[] = [];
  const seen = new Set<string>();

  for (const def of regionDefs) {
    seen.add(def.id);
    packs.push({
      id: def.id,
      label: labelForKey(def.nameKey),
      bounds: def.bounds,
      ready: regions[def.id]?.state === 'ready',
    });
  }

  for (const def of legacyDefs) {
    if (seen.has(def.id) || regions[def.id]?.state !== 'ready') continue;
    seen.add(def.id);
    packs.push({
      id: def.id,
      label: labelForKey(def.nameKey),
      bounds: def.bounds,
      ready: true,
    });
  }

  for (const [id, entry] of Object.entries(customEntries)) {
    if (!entry.bounds || seen.has(id)) continue;
    seen.add(id);
    packs.push({
      id,
      label: entry.name ?? id,
      bounds: entry.bounds,
      ready: regions[id]?.state === 'ready',
    });
  }
  return packs;
}
