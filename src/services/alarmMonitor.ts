import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type * as Location from 'expo-location';

import { bearingTrue } from '../lib/geo/navigation';
import { processFixFromLocation } from '../lib/alarms/alarmCoordinator';
import { t } from '../i18n';
import { requestConfirm } from '../store/confirmStore';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import type { PassageWithLegs } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';
import { isFixStale, useLocationStore } from './locationService';

/** Foreground alarm UI — delegates processing to AlarmCoordinator; shows leg-advance prompts only here. */
export function useAlarmMonitor() {
  const fix = useLocationStore((s) => s.fix);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const alarmLimits = useNavigationStore((s) => s.alarmLimits);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const passages = usePassageStore((s) => s.passages);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);

  const passageDetailRef = useRef<PassageWithLegs | null>(null);
  const legPromptShownRef = useRef<number | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!activePassageId) {
      passageDetailRef.current = null;
      return;
    }
    void usePassageStore.getState().getPassageDetail(activePassageId).then((d) => {
      passageDetailRef.current = d;
    });
  }, [activePassageId, activeLegIndex, passages]);

  useEffect(() => {
    if (!appActive || !fix) return;
    if (isFixStale(fix) && !anchorAlarm?.active) return;

    void processFixFromLocation(
      {
        coords: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          speed: fix.speedMs,
          heading: fix.heading,
          accuracy: fix.accuracyM,
          altitude: fix.altitudeM,
        },
        timestamp: fix.timestamp,
      } as Location.LocationObject,
      {
        inBackground: false,
        allowLegAdvancePrompt: true,
        liveState: {
          anchorAlarm,
          goToTarget,
          alarmLimits,
          activeLegIndex,
          activePassageId,
          passageDetail: passageDetailRef.current,
          legAdvanceAuto,
        },
      },
    ).then(({ legAdvancePromptLegIdx }) => {
      const detail = passageDetailRef.current;
      if (
        detail &&
        legAdvancePromptLegIdx != null &&
        legAdvancePromptLegIdx !== legPromptShownRef.current &&
        !legAdvanceAuto &&
        detail.legs[legAdvancePromptLegIdx]
      ) {
        legPromptShownRef.current = legAdvancePromptLegIdx;
        const leg = detail.legs[legAdvancePromptLegIdx];
        void requestConfirm({
          title: t('alarms.legAdvanceTitle'),
          message: t('alarms.legAdvanceBody', {
            name: leg.to.name,
            bearing: Math.round(bearingTrue([fix.longitude, fix.latitude], [leg.to.longitude, leg.to.latitude])),
          }),
          confirmLabel: t('alarms.legAdvanceConfirm'),
          cancelLabel: t('alarms.legAdvanceLater'),
        }).then((confirmed) => {
          if (confirmed) {
            void usePassageStore.getState().setPassageActiveLeg(legAdvancePromptLegIdx + 1);
          }
        });
      } else if (legAdvancePromptLegIdx == null) {
        legPromptShownRef.current = null;
      }
    });
  }, [
    fix,
    anchorAlarm,
    goToTarget,
    alarmLimits,
    activePassageId,
    activeLegIndex,
    legAdvanceAuto,
    appActive,
  ]);
}
