import { useMemo } from 'react';

import { buildCoveragePacks, pointCoveredByReadyPacks, type CoveragePack } from '../lib/map/coverage';
import { REGION_PACKS } from '../map/regionPacks';
import { t } from '../i18n';
import { useOfflinePackStore } from '../store/offlinePackStore';

export type ChartCoverageAtPoint = {
  readyPackCount: number;
  covered: boolean;
  coveringLabels: string[];
};

/** Whether downloaded offline chart packs cover a map position. */
export function useChartCoverageAtPoint(latitude: number | null, longitude: number | null): ChartCoverageAtPoint {
  const regions = useOfflinePackStore((s) => s.regions);
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);

  return useMemo(() => {
    const customEntries: Record<string, { name?: string; bounds?: (typeof customBoundsIndex)[string] }> = {};
    for (const [id, bounds] of Object.entries(customBoundsIndex)) {
      customEntries[id] = { name: regions[id]?.displayName, bounds };
    }
    const packs: CoveragePack[] = buildCoveragePacks(
      regions,
      REGION_PACKS.map((p) => ({ id: p.id, nameKey: p.nameKey, bounds: p.bounds })),
      customEntries,
      (key) => t(key as 'downloads.packs.kielBay.name'),
    );
    const readyPackCount = packs.filter((p) => p.ready).length;
    if (latitude == null || longitude == null || readyPackCount === 0) {
      return { readyPackCount, covered: false, coveringLabels: [] };
    }
    const coveringLabels = pointCoveredByReadyPacks(latitude, longitude, packs);
    return { readyPackCount, covered: coveringLabels.length > 0, coveringLabels };
  }, [latitude, longitude, regions, customBoundsIndex]);
}
