import { requestConfirm } from '../../store/confirmStore';
import { t } from '../../i18n';

/**
 * Safety gate before enabling unofficial depths — user must acknowledge
 * “not for navigation” (mirrors cellular-download confirm pattern).
 */
export async function confirmEnableDepthOverlay(): Promise<boolean> {
  return requestConfirm({
    title: t('settings.depthOverlayConfirmTitle'),
    message: t('settings.depthOverlayConfirmBody'),
    confirmLabel: t('settings.depthOverlayConfirmEnable'),
    cancelLabel: t('common.cancel'),
    destructive: false,
  });
}
