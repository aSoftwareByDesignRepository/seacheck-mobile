import type { RegionPackDefinition } from '../../map/regionPacks';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { packHasDownloadFailure } from './packDownloadPresentation';

/** Expand a corridor group when any pack needs attention (downloaded, active, or failed). */
export function corridorGroupNeedsAttention(
  packs: RegionPackDefinition[],
  regions: Record<string, RegionPackStatus>,
): boolean {
  return packs.some((pack) => {
    const status = regions[pack.id] ?? { regionId: pack.id, state: 'idle' as const, error: null };
    return status.state === 'ready' || status.state === 'downloading' || packHasDownloadFailure(status);
  });
}

export function countNonIdlePacks(
  packs: RegionPackDefinition[],
  regions: Record<string, RegionPackStatus>,
): number {
  return packs.filter((pack) => (regions[pack.id]?.state ?? 'idle') !== 'idle').length;
}
