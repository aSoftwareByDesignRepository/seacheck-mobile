import { packHasDownloadFailure, resolvePackDisplayName } from '../../features/downloads/packDownloadPresentation';
import { t } from '../../i18n';
import { useDownloadFailureStore } from '../../store/downloadFailureStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { peekDownloadSessionPhase } from './downloadFailureDiagnostics';
import { buildDownloadFailureReport, type DownloadFailureInput } from './buildDownloadFailureReport';

let lastReportKey = '';
let lastReportAt = 0;

/** Normalize thrown values for reports — keeps message + stack when available. */
export function formatThrowable(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message.trim() || error.name || 'Error',
      stack: error.stack?.trim() ?? null,
    };
  }
  const message = String(error ?? '').trim();
  return { message: message || 'Unknown error', stack: null };
}

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
  const { message: thrownMessage, stack } = formatThrowable(error);
  const message =
    status?.error?.trim() ||
    thrownMessage ||
    t('downloads.downloadFailed');

  if (source === 'preflight') {
    useOfflinePackStore.getState().markPreflightDownloadFailed(regionId, message);
  }

  void reportDownloadFailure({
    regionId,
    message,
    source,
    extra: {
      phase: peekDownloadSessionPhase(regionId),
      stackTrace: stack,
    },
  });
}

/** Uncaught/async download pipeline failure — opens the copyable debug modal with stack trace. */
export function reportDownloadFailureFromThrowable(
  regionId: string,
  error: unknown,
  source: DownloadFailureInput['source'] = 'async',
  phase?: string,
): Promise<void> {
  const { message, stack } = formatThrowable(error);
  return reportDownloadFailure({
    regionId,
    message,
    source,
    extra: {
      phase: phase ?? peekDownloadSessionPhase(regionId),
      stackTrace: stack,
    },
  });
}
