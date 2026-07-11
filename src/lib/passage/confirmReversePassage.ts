import { t } from '../../i18n';
import { requestConfirm } from '../../store/confirmStore';

/** Confirm reversing an active passage — changes live go-to targets and alarms. */
export async function confirmReverseActivePassage(): Promise<boolean> {
  return requestConfirm({
    title: t('passage.reverseActiveTitle'),
    message: t('passage.reverseActiveBody'),
    confirmLabel: t('passage.reverse'),
    destructive: true,
  });
}
