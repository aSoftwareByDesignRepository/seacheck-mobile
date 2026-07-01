const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/** Device-local date + time for track logs, passage summaries, and audit readouts. */
export function formatDateTimeLocal(ms: number | Date): string {
  const date = ms instanceof Date ? ms : new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, DATE_TIME);
}

/** Device-local date only. */
export function formatDateLocal(ms: number | Date): string {
  const date = ms instanceof Date ? ms : new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
