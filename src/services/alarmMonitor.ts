import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { evaluateForegroundSafetyAlarms } from '../lib/alarms/evaluateForegroundSafetyAlarms';
import { bearingTrue } from '../lib/geo/navigation';
import { t } from '../i18n';
import { requestConfirm } from '../store/confirmStore';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import type { PassageWithLegs } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';
import { subscribeBackgroundLocationRunning } from '../lib/geo/backgroundLocationHealth';
import { useLocationStore } from './locationService';

const SAFETY_ALARM_HEARTBEAT_MS = 5_000;

function isSafetyMonitoringActive(
  anchorAlarm: ReturnType<typeof useNavigationStore.getState>['anchorAlarm'],
  mobTarget: ReturnType<typeof useNavigationStore.getState>['mobTarget'],
  goToTarget: ReturnType<typeof useNavigationStore.getState>['goToTarget'],
  activePassageId: string | null,
): boolean {
  return Boolean(
    anchorAlarm?.active || mobTarget != null || goToTarget != null || activePassageId != null,
  );
}

/** Foreground alarm UI — delegates processing to AlarmCoordinator; shows leg-advance prompts only here. */
export function useAlarmMonitor() {
  const fix = useLocationStore((s) => s.fix);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const alarmLimits = useNavigationStore((s) => s.alarmLimits);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const passages = usePassageStore((s) => s.passages);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);

  const getPassageDetail = usePassageStore((s) => s.getPassageDetail);
  const legPromptShownRef = useRef<number | null>(null);
  const [passageDetail, setPassageDetail] = useState<PassageWithLegs | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [bgRunning, setBgRunning] = useState<boolean | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return subscribeBackgroundLocationRunning(setBgRunning);
  }, []);

  useEffect(() => {
    if (!activePassageId) {
      setPassageDetail(null);
      return;
    }
    void getPassageDetail(activePassageId).then(setPassageDetail);
  }, [activePassageId, activeLegIndex, passages, getPassageDetail]);

  const liveState = {
    anchorAlarm,
    goToTarget,
    mobTarget,
    alarmLimits,
    activeLegIndex,
    activePassageId,
    passageDetail,
    legAdvanceAuto,
    distanceUnit,
  };

  useEffect(() => {
    if (!fix) return;

    const evaluationFix = fix;
    let cancelled = false;

    void (async () => {
      const result = await evaluateForegroundSafetyAlarms({
        appState,
        liveState,
        allowLegAdvancePrompt: appState === 'active',
        fix: evaluationFix,
      });
      if (cancelled || !result) return;

      const { legAdvancePromptLegIdx } = result;
      if (
        appState === 'active' &&
        passageDetail &&
        legAdvancePromptLegIdx != null &&
        legAdvancePromptLegIdx !== legPromptShownRef.current &&
        !legAdvanceAuto &&
        passageDetail.legs[legAdvancePromptLegIdx]
      ) {
        legPromptShownRef.current = legAdvancePromptLegIdx;
        const leg = passageDetail.legs[legAdvancePromptLegIdx];
        void requestConfirm({
          title: t('alarms.legAdvanceTitle'),
          message: t('alarms.legAdvanceBody', {
            name: leg.to.name,
            bearing: Math.round(
              bearingTrue(
                [evaluationFix.longitude, evaluationFix.latitude],
                [leg.to.longitude, leg.to.latitude],
              ),
            ),
          }),
          confirmLabel: t('alarms.legAdvanceConfirm'),
          cancelLabel: t('alarms.legAdvanceLater'),
        }).then((confirmed) => {
          if (confirmed) {
            void usePassageStore.getState().setPassageActiveLeg(legAdvancePromptLegIdx + 1);
          } else {
            legPromptShownRef.current = null;
          }
        });
      } else if (legAdvancePromptLegIdx == null) {
        legPromptShownRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fix,
    anchorAlarm,
    mobTarget,
    goToTarget,
    alarmLimits,
    activePassageId,
    activeLegIndex,
    legAdvanceAuto,
    appState,
    distanceUnit,
    passageDetail,
  ]);

  /** Re-evaluate on a timer so anchor GPS-lost repeats and bg-task loss gaps are covered. */
  useEffect(() => {
    if (!isSafetyMonitoringActive(anchorAlarm, mobTarget, goToTarget, activePassageId)) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await evaluateForegroundSafetyAlarms({
        appState,
        liveState,
        allowLegAdvancePrompt: false,
      });
    };

    void tick();
    const interval = setInterval(() => void tick(), SAFETY_ALARM_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    anchorAlarm,
    mobTarget,
    goToTarget,
    alarmLimits,
    activePassageId,
    activeLegIndex,
    legAdvanceAuto,
    appState,
    distanceUnit,
    passageDetail,
    bgRunning,
  ]);
}
