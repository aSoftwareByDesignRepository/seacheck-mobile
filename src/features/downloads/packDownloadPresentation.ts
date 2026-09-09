import type { RegionPackStatus } from '../../store/offlinePackStore';
import { t } from '../../i18n';
import { downloadCoordinator } from '../../lib/offline/downloadCoordinator';
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
  if (status.state === 'downloading') return true;
  return activeDownloadRegionId === regionId && status.state !== 'ready';
}

/**
 * Whether a pack's Download / Delete / Retry controls should appear busy.
 *
 * Exclusive store locks (`activeDownloadRegionId` / teardown) gate other packs for the
 * whole session. Local `actionBusyId` is only the short kickoff/preflight window and
 * must never outlive those locks — otherwise every other pack stays grey forever.
 */
export function isPackActionBusy(input: {
  packId: string;
  hydrated: boolean;
  status: Pick<RegionPackStatus, 'state'>;
  activeDownloadRegionId: string | null;
  downloadMapTeardownRegionId: string | null;
  actionBusyId: string | null;
}): boolean {
  if (!input.hydrated) return true;
  if (isPackDownloadActive(input.packId, input.status, input.activeDownloadRegionId)) return false;
  const downloadLocksOtherPacks =
    input.activeDownloadRegionId != null || input.downloadMapTeardownRegionId != null;
  return downloadLocksOtherPacks || (input.actionBusyId != null && input.actionBusyId !== input.packId);
}


/** Visible download map should stay mounted while tiles download or finalize.
 *  All other MapLibre surfaces must suspend during this window (Android GL crash guard). */
export function isDownloadMapSessionActive(
  regionId: string,
  status: Pick<RegionPackStatus, 'state'> | undefined,
  activeDownloadRegionId: string | null,
  downloadMapTeardownRegionId: string | null = null,
): boolean {
  // Preflight may show downloading UI before the exclusive GL session starts — keep the
  // minimap + hidden engine alive so chart style and tiles can prime (July behaviour).
  if (downloadCoordinator.isPreflightOnly()) return false;
  const ownsMap = activeDownloadRegionId === regionId || downloadMapTeardownRegionId === regionId;
  if (!ownsMap) return false;
  // Cancel clears downloading UI immediately but GL teardown must keep the TextureView
  // until the coordinator timer ends — otherwise Android remounts a second map.
  if (downloadMapTeardownRegionId === regionId) return true;
  // Completing keeps state=downloading until Ready flips after teardown — both must hold the map.
  return status?.state === 'downloading' || status?.state === 'ready';
}

/** True when any chart download map owns the sole GL context (including post-session teardown). */
export function hasExclusiveChartDownloadMap(
  activeDownloadRegionId: string | null,
  downloadMapTeardownRegionId: string | null,
): boolean {
  return activeDownloadRegionId != null || downloadMapTeardownRegionId != null;
}

export function packStatusLabel(
  status: Pick<RegionPackStatus, 'state' | 'percentage' | 'error' | 'downloadInitializing'>,
): string {
  if (packHasDownloadFailure(status)) return t('downloads.statusError');
  if (status.state === 'ready') return t('downloads.statusReady');
  if (status.state === 'downloading') {
    if (status.percentage >= 99) {
      return t('downloads.statusCompleting');
    }
    if (status.downloadInitializing || status.percentage <= 0) {
      return t('downloads.statusInitializing');
    }
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

/**
 * Ready banner body must not claim seamarks work while any ready pack still
 * shows "not indexed". Full charts+seamarks voice only when every ready pack
 * has finished indexing.
 */
export function readySummaryHintKey(
  regions: Record<string, Pick<RegionPackStatus, 'state' | 'seamarksIndexed'>>,
): 'downloads.statusSummaryReadyHint' | 'downloads.statusSummaryReadyHintBaseOnly' {
  const ready = Object.values(regions).filter((r) => r.state === 'ready');
  if (ready.length === 0) return 'downloads.statusSummaryReadyHint';
  const allSeamarksIndexed = ready.every((r) => r.seamarksIndexed === true);
  return allSeamarksIndexed
    ? 'downloads.statusSummaryReadyHint'
    : 'downloads.statusSummaryReadyHintBaseOnly';
}
