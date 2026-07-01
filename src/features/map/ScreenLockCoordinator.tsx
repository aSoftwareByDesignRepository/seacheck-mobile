import { useEffect, useRef } from 'react';

import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useTabOverflowStore } from '../../navigation/tabOverflowStore';
import { useSheetHost } from '../../ui/sheetHost';

/**
 * Runs side effects when screen lock engages — dismisses modals, menus, and
 * feedback so nothing stays interactive above the lock overlay.
 */
export function ScreenLockCoordinator() {
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const { dismissAll } = useSheetHost();
  const setMenuOpen = useTabOverflowStore((s) => s.setMenuOpen);
  const clearFeedback = useFeedbackStore((s) => s.clear);
  const wasLockedRef = useRef(false);

  useEffect(() => {
    if (!screenLocked) {
      wasLockedRef.current = false;
      return;
    }
    if (wasLockedRef.current) return;
    wasLockedRef.current = true;

    dismissAll();
    setMenuOpen(false);
    clearFeedback();
  }, [screenLocked, dismissAll, setMenuOpen, clearFeedback]);

  return null;
}
