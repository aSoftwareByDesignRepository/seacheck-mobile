import { t } from '../../i18n';
import { downloadCoordinator } from './downloadCoordinator';

/**
 * Transition preflight lock → active download session.
 * tryBegin already promotes a same-region preflight lock atomically — do not
 * release+retry (that opened a window for a second caller to steal the slot).
 */
export function beginDownloadSession(regionId: string): number {
  const session = downloadCoordinator.tryBegin(regionId);
  if (session != null) return session;
  throw new Error(t('downloads.errorDownloadBusy'));
}

/** Release a preflight lock when startDownload fails before the session begins. */
export function abandonDownloadSession(regionId: string): void {
  downloadCoordinator.releasePreflightLock(regionId);
}
