import { useMemo } from 'react';

import {
  assessPassageCoverage,
  buildCoveragePacks,
  suggestPacksForPassage,
  type PassageCoverageReport,
  type SuggestPacksResult,
} from '../lib/map/coverage';
import { LEGACY_REGION_PACKS } from '../map/legacyRegionPacks';
import { getRegionPack, REGION_PACKS, type RegionPackDefinition } from '../map/regionPacks';
import { validateRegionPack } from '../map/regionPackValidation';
import { t } from '../i18n';
import type { RegionPackStatus } from '../store/offlinePackStore';
import { useOfflinePackStore } from '../store/offlinePackStore';

export type PassagePackSuggestionDetail = {
  packId: string;
  coversLegCount: number;
  pack: RegionPackDefinition;
  label: string;
  sizeLabel: string;
  status: RegionPackStatus;
};

export type PassagePackSuggestions = PassageCoverageReport &
  SuggestPacksResult & {
    suggestionDetails: PassagePackSuggestionDetail[];
    focusPackIds: string[];
  };

function buildCoverageContext(
  regions: ReturnType<typeof useOfflinePackStore.getState>['regions'],
  customBoundsIndex: ReturnType<typeof useOfflinePackStore.getState>['customBoundsIndex'],
) {
  const customEntries: Record<string, { name?: string; bounds?: (typeof customBoundsIndex)[string] }> = {};
  for (const [id, bounds] of Object.entries(customBoundsIndex)) {
    customEntries[id] = { name: regions[id]?.displayName, bounds };
  }
  const legacyReady = LEGACY_REGION_PACKS.filter((p) => regions[p.id]?.state === 'ready').map((p) => ({
    id: p.id,
    nameKey: p.nameKey,
    bounds: p.bounds,
  }));
  const packs = buildCoveragePacks(
    regions,
    REGION_PACKS.map((p) => ({ id: p.id, nameKey: p.nameKey, bounds: p.bounds })),
    customEntries,
    (key) => t(key as 'downloads.packs.kielBay.name'),
    legacyReady,
  );
  const readyIds = new Set(
    Object.entries(regions)
      .filter(([, r]) => r.state === 'ready')
      .map(([id]) => id),
  );
  return { packs, readyIds };
}

export function usePassagePackSuggestions(
  waypoints: { name: string; latitude: number; longitude: number }[],
): PassagePackSuggestions {
  const regions = useOfflinePackStore((s) => s.regions);
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);

  return useMemo(() => {
    const { packs, readyIds } = buildCoverageContext(regions, customBoundsIndex);
    const report = assessPassageCoverage(waypoints, packs);
    const readyPacks = packs.filter((p) => p.ready);
    const candidates = REGION_PACKS.filter((p) => validateRegionPack(p).ok).map((p) => ({
      id: p.id,
      bounds: p.bounds,
      priority: p.priority,
    }));
    const suggestionResult = suggestPacksForPassage(waypoints, candidates, readyPacks, readyIds);

    const suggestionDetails: PassagePackSuggestionDetail[] = [];
    for (const suggestion of suggestionResult.suggestions) {
      const pack = getRegionPack(suggestion.packId);
      if (!pack) continue;
      const validation = validateRegionPack(pack);
      suggestionDetails.push({
        ...suggestion,
        pack,
        label: t(pack.nameKey as 'downloads.packs.kielBay.name'),
        sizeLabel: validation.sizeLabel,
        status: regions[suggestion.packId] ?? {
          regionId: suggestion.packId,
          state: 'idle',
          percentage: 0,
          packId: null,
          error: null,
        },
      });
    }

    return {
      ...report,
      ...suggestionResult,
      suggestionDetails,
      focusPackIds: suggestionDetails.map((s) => s.packId),
    };
  }, [waypoints, regions, customBoundsIndex]);
}
