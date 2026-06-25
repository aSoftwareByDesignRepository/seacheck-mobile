import * as Clipboard from 'expo-clipboard';

import { isSafetyFixOk, isValidCoordinate } from '../geo/fixQuality';
import { t } from '../../i18n';
import type { CoordFormat } from '../../settings/defaults';
import { useLocationStore } from '../../services/locationService';
import type { LocationFix } from '../../services/locationService';
import { buildMaydayMessage, type VesselInfo } from './maydayMessage';

export type MaydayCopyQuality = 'fresh' | 'stale' | 'unavailable';

/** Pick the best available fix for a Mayday message — never silently invent a position. */
export function pickMaydayFix(): { fix: LocationFix | null; quality: MaydayCopyQuality } {
  const { fix, lastGoodFix } = useLocationStore.getState();

  if (fix && isSafetyFixOk(fix)) {
    return { fix, quality: 'fresh' };
  }
  if (fix && isValidCoordinate(fix.latitude, fix.longitude)) {
    return { fix, quality: 'stale' };
  }
  if (lastGoodFix && isValidCoordinate(lastGoodFix.latitude, lastGoodFix.longitude)) {
    return { fix: lastGoodFix, quality: 'stale' };
  }
  return { fix: null, quality: 'unavailable' };
}

export function maydayCopyFeedbackKey(quality: MaydayCopyQuality): string {
  if (quality === 'fresh') return 'settings.emergencyCopy';
  if (quality === 'stale') return 'map.emergencyCopyStale';
  return 'map.emergencyNoGpsBody';
}

/** Copy Mayday text to the clipboard; returns quality for user feedback. */
export async function copyMaydayToClipboard(
  vessel: VesselInfo,
  coordFormat: CoordFormat,
): Promise<MaydayCopyQuality> {
  const { fix, quality } = pickMaydayFix();
  if (!fix) return 'unavailable';
  const text = buildMaydayMessage(vessel, fix, coordFormat);
  await Clipboard.setStringAsync(text);
  return quality;
}

export function maydayUnavailableMessage(): string {
  return t('map.emergencyNoGpsBody');
}
