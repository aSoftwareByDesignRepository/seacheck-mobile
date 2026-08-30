import type { AnchorAlarmState } from '../../store/navigationStore';

/** True when map/settings must show non-success “limited watch” chrome. */
export function isAnchorWatchLimitedChrome(
  alarm: Pick<AnchorAlarmState, 'active' | 'armedLimited'> | null | undefined,
  liveLimited = false,
): boolean {
  if (!alarm?.active) return false;
  return Boolean(alarm.armedLimited) || liveLimited;
}
