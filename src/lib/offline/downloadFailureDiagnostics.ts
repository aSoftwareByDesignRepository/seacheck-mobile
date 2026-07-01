import type { StallDiagnostics } from './downloadStallWatchdog';

const lastByRegion = new Map<string, StallDiagnostics>();

export function rememberDownloadFailureDiagnostics(regionId: string, diagnostics: StallDiagnostics): void {
  lastByRegion.set(regionId, diagnostics);
}

export function peekDownloadFailureDiagnostics(regionId: string): StallDiagnostics | undefined {
  return lastByRegion.get(regionId);
}

/** Test-only */
export function clearDownloadFailureDiagnosticsForTests(): void {
  lastByRegion.clear();
}
