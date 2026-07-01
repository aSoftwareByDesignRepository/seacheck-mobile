const ETA_TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

/** Local wall-clock time for display (device timezone / locale). */
export function formatTimeLocal(date: Date): string {
  return date.toLocaleTimeString(undefined, ETA_TIME);
}

/** Format a UTC ISO timestamp as local HH:mm for ETA readouts. */
export function formatEtaLocalFromIso(isoUtc: string | null | undefined): string | null {
  if (!isoUtc) return null;
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return null;
  return formatTimeLocal(date);
}

/** ETA from hours ahead of now — uses device local time, not UTC. */
export function formatEtaAheadHours(hours: number, referenceMs = Date.now()): string | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return formatTimeLocal(new Date(referenceMs + hours * 3_600_000));
}
