import NetInfo from '@react-native-community/netinfo';

import { t } from '../../i18n';
import { requestConfirm } from '../../store/confirmStore';
import { useSettingsStore } from '../../store/settingsStore';

function isWifiLike(type: string | undefined): boolean {
  return type === 'wifi' || type === 'ethernet' || type === 'wimax';
}

/** Returns true when download may proceed (Wi‑Fi, setting off, or user confirmed cellular). */
export async function ensureDownloadAllowed(): Promise<boolean> {
  if (!useSettingsStore.getState().downloadWifiOnly) return true;

  const state = await NetInfo.fetch();
  if (isWifiLike(state.type)) return true;

  return requestConfirm({
    title: t('downloads.cellularWarnTitle'),
    message: t('downloads.cellularWarnBody'),
    confirmLabel: t('downloads.cellularProceed'),
    destructive: true,
  });
}
