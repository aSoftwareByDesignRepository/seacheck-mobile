import { useMemo } from 'react';

import { assessPassageCoverage, buildCoveragePacks, type PassageCoverageReport } from '../lib/map/coverage';
import { LEGACY_REGION_PACKS } from '../map/legacyRegionPacks';
import { REGION_PACKS } from '../map/regionPacks';
import { t } from '../i18n';
import { useOfflinePackStore } from '../store/offlinePackStore';

export function usePassageCoverage(waypoints: { name: string; latitude: number; longitude: number }[]): PassageCoverageReport {
  const regions = useOfflinePackStore((s) => s.regions);
  const customBoundsIndex = useOfflinePackStore((s) => s.customBoundsIndex);

  return useMemo(() => {
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
    return assessPassageCoverage(waypoints, packs);
  }, [waypoints, regions, customBoundsIndex]);
}
