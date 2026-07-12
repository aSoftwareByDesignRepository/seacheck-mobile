import { useCallback, useState } from 'react';

import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { usePassageStore } from '../store/passageStore';

/**
 * Single deactivate workflow for list, detail, map dock, and planning panel.
 * Guards against double-tap races and no-op when nothing is active.
 */
export function usePassageDeactivate() {
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const deactivatePassage = usePassageStore((s) => s.deactivatePassage);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const [deactivating, setDeactivating] = useState(false);

  const deactivate = useCallback(async (): Promise<boolean> => {
    if (deactivating) return false;
    if (!usePassageStore.getState().activePassageId) return false;
    setDeactivating(true);
    try {
      await deactivatePassage();
      showInfo(t('passage.deactivated'));
      return true;
    } catch {
      showError(t('passage.deactivateFailed'));
      return false;
    } finally {
      setDeactivating(false);
    }
  }, [deactivating, deactivatePassage, showInfo, showError]);

  return {
    deactivate,
    deactivating,
    canDeactivate: Boolean(activePassageId),
  };
}
