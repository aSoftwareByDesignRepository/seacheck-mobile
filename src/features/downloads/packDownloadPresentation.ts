import type { RegionPackStatus } from '../../store/offlinePackStore';
import { t } from '../../i18n';
import { resolveRegionPack } from '../../map/regionPacks';

export type PackStatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export type FailedPackSummary = {
  regionId: string;
  name: string;
  error: string;
};

/** Pack has a user-visible download failure (hard error or re-download of a ready pack). */
export function packHasDownloadFailure(status: Pick<RegionPackStatus, 'state' | 'error'>): boolean {
  return status.state === 'error' || (status.state === 'ready' && status.error != null && status.error.trim() !== '');
}

export function resolvePackDisplayName(status: Pick<RegionPackStatus, 'regionId' | 'displayName'>): string {
  if (status.displayName?.trim()) return status.displayName.trim();
  const def = resolveRegionPack(status.regionId);
  if (def) return t(def.nameKey as 'downloads.packs.kielBay.name');
  return status.regionId;
}

export function listFailedPacks(regions: Record<string, RegionPackStatus>): FailedPackSummary[] {
  return Object.values(regions)
    .filter(packHasDownloadFailure)
    .map((status) => ({
      regionId: status.regionId,
      name: resolvePackDisplayName(status),
      error: status.error?.trim() || t('downloads.downloadFailed'),
    }));
}

export function countFailedPacks(regions: Record<string, Pick<RegionPackStatus, 'state' | 'error'>>): number {
  return Object.values(regions).filter(packHasDownloadFailure).length;
}

/** Whether this pack has an active native download session (including pre-progress kickstart). */
export function isPackDownloadActive(
  regionId: string,
  status: Pick<RegionPackStatus, 'state'>,
  activeDownloadRegionId: string | null,
): boolean {
  return status.state === 'downloading' || activeDownloadRegionId === regionId;
}

export function packStatusLabel(status: Pick<RegionPackStatus, 'state' | 'percentage' | 'error'>): string {
  if (packHasDownloadFailure(status)) return t('downloads.statusError');
  if (status.state === 'ready') return t('downloads.statusReady');
  if (status.state === 'downloading') {
    return t('downloads.statusDownloading', { percent: Math.round(status.percentage) });
  }
  if (status.state === 'error') return t('downloads.statusError');
  return t('downloads.statusIdle');
}

export function packStatusBadgeVariant(
  status: Pick<RegionPackStatus, 'state' | 'error'>,
): PackStatusBadgeVariant {
  if (packHasDownloadFailure(status)) return 'danger';
  if (status.state === 'ready') return 'success';
  if (status.state === 'downloading') return 'warning';
  if (status.state === 'error') return 'danger';
  return 'neutral';
}

export function seamarkStatusLabel(
  status: Pick<RegionPackStatus, 'state' | 'seamarksIndexed' | 'seamarksIndexing'>,
): string | null {
  if (status.state !== 'ready') return null;
  if (status.seamarksIndexing) return t('downloads.seamarksIndexing');
  if (status.seamarksIndexed) return t('downloads.seamarksReady');
  return t('downloads.seamarksPending');
}

export function countReadyPacks(regions: Record<string, Pick<RegionPackStatus, 'state'>>): number {
  return Object.values(regions).filter((r) => r.state === 'ready').length;
}
