import { packHasDownloadFailure, resolvePackDisplayName } from '../../features/downloads/packDownloadPresentation';
import { t } from '../../i18n';
import { useDownloadFailureStore } from '../../store/downloadFailureStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { buildDownloadFailureReport, type DownloadFailureInput } from './buildDownloadFailureReport';

let lastReportKey = '';
let lastReportAt = 0;

/** Show copyable failure modal for chart download errors (always fails visibly). */
export async function reportDownloadFailure(input: DownloadFailureInput): Promise<void> {
  const key = `${input.regionId}:${input.message}`;
  const now = Date.now();
  if (key === lastReportKey && now - lastReportAt < 3000) return;
  lastReportKey = key;
  lastReportAt = now;

  const status = useOfflinePackStore.getState().regions[input.regionId];
  const name = resolvePackDisplayName(status ?? { regionId: input.regionId, displayName: input.extra?.displayName as string | undefined });
  const report = await buildDownloadFailureReport(input);

  useDownloadFailureStore.getState().show({
    title: t('downloads.failureModal.title'),
    summary: t('downloads.failureModal.summary', { name, error: input.message }),
    report,
  });
}

/** Open the failure modal for an existing failed pack (e.g. from banner or card). */
export function reportDownloadFailureFromRegion(regionId: string): void {
  const status = useOfflinePackStore.getState().regions[regionId];
  if (!status || !packHasDownloadFailure(status)) return;
  void reportDownloadFailure({
    regionId,
    message: status.error?.trim() || t('downloads.downloadFailed'),
    source: 'manual',
  });
}

export function reportDownloadFailureFromError(regionId: string, error: unknown, source: DownloadFailureInput['source'] = 'preflight'): void {
  const status = useOfflinePackStore.getState().regions[regionId];
  const message =
    status?.error?.trim() ||
    (error instanceof Error ? error.message : String(error ?? '')).trim() ||
    t('downloads.downloadFailed');

  if (source === 'preflight') {
    useOfflinePackStore.getState().markPreflightDownloadFailed(regionId, message);
  }

  void reportDownloadFailure({ regionId, message, source });
}
