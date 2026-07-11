import { t } from '../../i18n';
import { downloadCoordinator } from './downloadCoordinator';

/**
 * Transition preflight lock → active download session.
 * Cleans up a stale preflight lock when a prior attempt failed before tryBegin.
 */
export function beginDownloadSession(regionId: string): number {
  const session = downloadCoordinator.tryBegin(regionId);
  if (session != null) return session;

  if (downloadCoordinator.hasPreflightLock(regionId)) {
    downloadCoordinator.releasePreflightLock(regionId);
    const retry = downloadCoordinator.tryBegin(regionId);
    if (retry != null) return retry;
  }

  throw new Error(t('downloads.errorDownloadBusy'));
}

/** Release a preflight lock when startDownload fails before the session begins. */
export function abandonDownloadSession(regionId: string): void {
  downloadCoordinator.releasePreflightLock(regionId);
}
