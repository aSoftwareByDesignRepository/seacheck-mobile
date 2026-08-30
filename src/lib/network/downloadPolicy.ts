import NetInfo from '@react-native-community/netinfo';

import { t } from '../../i18n';
import { requestConfirm } from '../../store/confirmStore';
import { useSettingsStore } from '../../store/settingsStore';

function isWifiLike(type: string | undefined): boolean {
  return type === 'wifi' || type === 'ethernet' || type === 'wimax';
}

export type DownloadPermission =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'cancelled' };

function cellularConfirm(): Promise<boolean> {
  return requestConfirm({
    title: t('downloads.cellularWarnTitle'),
    message: t('downloads.cellularWarnBody'),
    confirmLabel: t('downloads.cellularProceed'),
    destructive: true,
  });
}

/**
 * Returns whether a chart pack download may proceed under the Wi‑Fi-only setting.
 *
 * - Wi‑Fi / ethernet / wimax: allowed
 * - Cellular (and other connected non-Wi‑Fi types): user must confirm
 * - Disconnected: blocked as offline (no misleading cellular dialog)
 * - NetInfo failure: ask the user — never silently allow on the Wi‑Fi-only path
 */
export async function ensureDownloadAllowed(): Promise<DownloadPermission> {
  if (!useSettingsStore.getState().downloadWifiOnly) return { ok: true };

  let state: Awaited<ReturnType<typeof NetInfo.fetch>>;
  try {
    state = await NetInfo.fetch();
  } catch {
    const proceeded = await cellularConfirm();
    return proceeded ? { ok: true } : { ok: false, reason: 'cancelled' };
  }

  if (state.isConnected === false) {
    return { ok: false, reason: 'offline' };
  }

  if (isWifiLike(state.type)) return { ok: true };

  const proceeded = await cellularConfirm();
  return proceeded ? { ok: true } : { ok: false, reason: 'cancelled' };
}
