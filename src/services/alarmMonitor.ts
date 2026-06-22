import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { bearingTrue, crossTrackErrorNm, distanceNm, type LonLat } from '../lib/geo/navigation';
import { t } from '../i18n';
import { triggerMaritimeAlarm } from './alarmFeedbackService';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import type { PassageWithLegs } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';
import { isFixStale, useLocationStore } from './locationService';

/** Monitors anchor drag, arrival, and XTE alarms while GPS updates. */
export function useAlarmMonitor() {
  const fix = useLocationStore((s) => s.fix);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const alarmLimits = useNavigationStore((s) => s.alarmLimits);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);
  const setAnchorTriggered = useNavigationStore((s) => s.setAnchorTriggered);

  const passageDetailRef = useRef<PassageWithLegs | null>(null);
  const lastPosRef = useRef<LonLat | null>(null);
  const arrivalFiredRef = useRef<string | null>(null);
  const xteFiredRef = useRef(false);
  const legAdvancePromptRef = useRef<number | null>(null);
  const lastCriticalPulseRef = useRef(0);

  useEffect(() => {
    if (!activePassageId) {
      passageDetailRef.current = null;
      return;
    }
    void usePassageStore.getState().getPassageDetail(activePassageId).then((d) => {
      passageDetailRef.current = d;
    });
  }, [activePassageId, activeLegIndex]);

  useEffect(() => {
    if (!fix || isFixStale(fix)) return;
    const pos: LonLat = [fix.longitude, fix.latitude];

    if (lastPosRef.current) {
      const seg = distanceNm(lastPosRef.current, pos);
      if (seg > 0.001 && seg < 2 && (fix.speedKn ?? 0) > 0.3) {
        void useNavigationStore.getState().addSessionDistanceNm(seg);
      }
    }
    lastPosRef.current = pos;

    if (anchorAlarm?.active) {
      const drift = distanceNm([anchorAlarm.longitude, anchorAlarm.latitude], pos);
      if (drift > anchorAlarm.radiusNm) {
        if (!anchorAlarm.triggered) {
          void setAnchorTriggered(true);
          lastCriticalPulseRef.current = Date.now();
          void triggerMaritimeAlarm(
            'critical',
            `${t('alarms.anchorDragTitle')}: ${t('alarms.anchorDragBody', { nm: drift.toFixed(2) })}`,
          );
        } else if (Date.now() - lastCriticalPulseRef.current > 45_000) {
          lastCriticalPulseRef.current = Date.now();
          void triggerMaritimeAlarm(
            'critical',
            `${t('alarms.anchorDragTitle')}: ${t('alarms.anchorDragBody', { nm: drift.toFixed(2) })}`,
          );
        }
      } else if (anchorAlarm.triggered) {
        void setAnchorTriggered(false);
      }
    }

    const target = goToTarget;
    if (target) {
      const dist = distanceNm(pos, [target.longitude, target.latitude]);
      if (dist <= alarmLimits.arrivalNm && arrivalFiredRef.current !== target.id) {
        arrivalFiredRef.current = target.id;
        void triggerMaritimeAlarm(
          'warning',
          `${t('alarms.arrivalTitle')}: ${t('alarms.arrivalBody', { name: target.name, nm: dist.toFixed(2) })}`,
        );
      } else if (dist > alarmLimits.arrivalNm * 2) {
        arrivalFiredRef.current = null;
      }
    }

    const detail = passageDetailRef.current;
    if (detail && detail.legs.length > 0 && activePassageId) {
      const legIdx = Math.min(activeLegIndex, detail.legs.length - 1);
      const leg = detail.legs[legIdx];
      const xte = Math.abs(
        crossTrackErrorNm(
          pos,
          [leg.from.longitude, leg.from.latitude],
          [leg.to.longitude, leg.to.latitude],
        ),
      );
      if (xte > alarmLimits.xteNm) {
        if (!xteFiredRef.current) {
          xteFiredRef.current = true;
          void triggerMaritimeAlarm(
            'warning',
            `${t('alarms.xteTitle')}: ${t('alarms.xteBody', { nm: xte.toFixed(2) })}`,
          );
        }
      } else {
        xteFiredRef.current = false;
      }

      const distToWp = distanceNm(pos, [leg.to.longitude, leg.to.latitude]);
      if (distToWp <= alarmLimits.arrivalNm && legIdx < detail.legs.length - 1) {
        if (legAdvanceAuto) {
          void usePassageStore.getState().setPassageActiveLeg(legIdx + 1);
          legAdvancePromptRef.current = null;
        } else if (legAdvancePromptRef.current !== legIdx) {
          legAdvancePromptRef.current = legIdx;
          Alert.alert(
            t('alarms.legAdvanceTitle'),
            t('alarms.legAdvanceBody', { name: leg.to.name, bearing: Math.round(bearingTrue(pos, [leg.to.longitude, leg.to.latitude])) }),
            [
              { text: t('alarms.legAdvanceLater'), style: 'cancel' },
              {
                text: t('alarms.legAdvanceConfirm'),
                onPress: () => {
                  void usePassageStore.getState().setPassageActiveLeg(legIdx + 1);
                  void triggerMaritimeAlarm('warning', t('alarms.legAdvanced', { name: leg.to.name }));
                },
              },
            ],
          );
        }
      } else if (distToWp > alarmLimits.arrivalNm * 2) {
        legAdvancePromptRef.current = null;
      }
    }
  }, [
    fix,
    anchorAlarm,
    goToTarget,
    alarmLimits,
    activePassageId,
    activeLegIndex,
    legAdvanceAuto,
    setAnchorTriggered,
  ]);
}
