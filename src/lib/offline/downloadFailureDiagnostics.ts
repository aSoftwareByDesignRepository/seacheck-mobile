import type { StallDiagnostics } from './downloadStallWatchdog';

const lastByRegion = new Map<string, StallDiagnostics>();
const sessionPhaseByRegion = new Map<string, string>();

export function rememberDownloadFailureDiagnostics(regionId: string, diagnostics: StallDiagnostics): void {
  lastByRegion.set(regionId, diagnostics);
}

export function peekDownloadFailureDiagnostics(regionId: string): StallDiagnostics | undefined {
  return lastByRegion.get(regionId);
}

/** Last known download pipeline phase — included in copyable failure reports. */
export function rememberDownloadSessionPhase(regionId: string, phase: string): void {
  sessionPhaseByRegion.set(regionId, phase);
}

export function peekDownloadSessionPhase(regionId: string): string | undefined {
  return sessionPhaseByRegion.get(regionId);
}

export function clearDownloadSessionPhase(regionId: string): void {
  sessionPhaseByRegion.delete(regionId);
}

/** Test-only */
export function clearDownloadFailureDiagnosticsForTests(): void {
  lastByRegion.clear();
  sessionPhaseByRegion.clear();
}
