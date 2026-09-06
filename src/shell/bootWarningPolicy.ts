/**
 * Boot partial-warning policy — offline chart hydrate failures must stay visible.
 * Other soft warnings may be dismissed for the session.
 */
export function isCriticalBootWarning(warning: string): boolean {
  return warning === 'offline';
}

export function bootWarningsIncludeCritical(warnings: readonly string[]): boolean {
  return warnings.some(isCriticalBootWarning);
}

/** Non-offline warnings can be dismissed; offline cannot (charts honesty). */
export function canDismissBootWarnings(warnings: readonly string[]): boolean {
  return warnings.length > 0 && !bootWarningsIncludeCritical(warnings);
}
