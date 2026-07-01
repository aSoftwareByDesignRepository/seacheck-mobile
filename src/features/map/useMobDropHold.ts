import { useCallback, useEffect, useRef, useState } from 'react';

import { isSafetyFixOk } from '../../lib/geo/fixQuality';
import { t } from '../../i18n';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useWaypointStore } from '../../store/waypointStore';

export const MOB_HOLD_MS = 2000;

type Options = {
  /** Called after a successful MOB drop (e.g. unlock screen for navigate-back UI). */
  onDropped?: () => void;
};

export function useMobDropHold(options: Options = {}) {
  const { onDropped } = options;
  const fix = useLocationStore((s) => s.fix);
  const dropMob = useNavigationStore((s) => s.dropMob);
  const createWaypoint = useWaypointStore((s) => s.create);
  const showError = useFeedbackStore((s) => s.showError);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);

  const [mobProgress, setMobProgress] = useState(0);
  const mobTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mobStart = useRef<number | null>(null);
  const mobBusy = useRef(false);
  const onDroppedRef = useRef(onDropped);
  onDroppedRef.current = onDropped;

  const clearMobTimer = useCallback(() => {
    if (mobTimer.current) clearInterval(mobTimer.current);
    mobTimer.current = null;
    mobStart.current = null;
    setMobProgress(0);
  }, []);

  useEffect(() => () => clearMobTimer(), [clearMobTimer]);

  const completeMobDrop = useCallback(async () => {
    if (mobBusy.current) return;
    if (!fix || !isSafetyFixOk(fix)) {
      showError(t('map.mobNoGpsBody'));
      return;
    }
    mobBusy.current = true;
    try {
      await dropMob(fix.latitude, fix.longitude);
      await createWaypoint({
        name: t('waypoints.types.mob'),
        latitude: fix.latitude,
        longitude: fix.longitude,
        type: 'mob',
      });
      showSuccess(t('map.mobDroppedBody'));
      onDroppedRef.current?.();
    } catch {
      showError(t('map.mobDropFailed'));
      await useNavigationStore.getState().clearMob().catch(() => {});
    } finally {
      mobBusy.current = false;
    }
  }, [fix, dropMob, createWaypoint, showError, showSuccess]);

  const onMobPressIn = useCallback(() => {
    if (mobBusy.current) return;
    mobStart.current = Date.now();
    mobTimer.current = setInterval(() => {
      if (!mobStart.current) return;
      const elapsed = Date.now() - mobStart.current;
      setMobProgress(Math.min(1, elapsed / MOB_HOLD_MS));
      if (elapsed >= MOB_HOLD_MS) {
        clearMobTimer();
        void completeMobDrop();
      }
    }, 50);
  }, [clearMobTimer, completeMobDrop]);

  const onMobPressOut = useCallback(() => {
    const startedAt = mobStart.current;
    if (startedAt && Date.now() - startedAt < MOB_HOLD_MS) {
      showInfo(t('map.mobHold'));
    }
    clearMobTimer();
  }, [clearMobTimer, showInfo]);

  return { mobProgress, onMobPressIn, onMobPressOut };
}
