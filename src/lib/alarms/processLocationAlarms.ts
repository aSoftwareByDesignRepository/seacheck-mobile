import { ANCHOR_SOG_MIN_DRIFT_NM } from '../geo/fixQuality';
import { bearingTrue, crossTrackErrorNm, distanceNm, type LonLat } from '../geo/navigation';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import type { AlarmLimits, AnchorAlarmState, NavigationTarget } from '../../store/navigationStore';
import { DEFAULT_ALARM_RUNTIME, type AlarmRuntimeState } from './alarmRuntimeState';

/** Re-fire anchor GPS-lost warning at this interval while fix is stale. */
export const ANCHOR_GPS_LOST_REPEAT_MS = 60_000;

/** Sustained SOG readings above this (kn) while at anchor trigger drag alarm. */
export const ANCHOR_SOG_KN = 0.5;

/** Consecutive GPS updates required before SOG drag alarm fires. */
export const ANCHOR_SOG_STREAK = 3;

/** Re-fire critical anchor alarm at this interval while triggered. */
export const ANCHOR_REPEAT_MS = 45_000;

export type LocationFixInput = {
  latitude: number;
  longitude: number;
  speedKn: number | null;
};

export type AlarmAction =
  | { type: 'trigger'; severity: 'warning' | 'critical'; message: string }
  | { type: 'set_anchor_triggered'; triggered: boolean }
  | { type: 'leg_advance_auto'; legIndex: number; waypointName: string };

export type AlarmProcessInput = {
  fix: LocationFixInput;
  anchorAlarm: AnchorAlarmState | null;
  goToTarget: NavigationTarget | null;
  alarmLimits: AlarmLimits;
  activePassageId: string | null;
  activeLegIndex: number;
  passageDetail: PassageWithLegs | null;
  legAdvanceAuto: boolean;
  /** When false, leg-advance prompts are skipped (background task). */
  allowLegAdvancePrompt: boolean;
  runtime: AlarmRuntimeState;
  nowMs?: number;
};

export type AlarmProcessOutput = {
  actions: AlarmAction[];
  runtime: AlarmRuntimeState;
  anchorAlarm: AnchorAlarmState | null;
};

export function processLocationAlarms(input: AlarmProcessInput): AlarmProcessOutput {
  const now = input.nowMs ?? Date.now();
  const runtime: AlarmRuntimeState = { ...input.runtime };
  let anchorAlarm = input.anchorAlarm ? { ...input.anchorAlarm } : null;
  const actions: AlarmAction[] = [];
  const pos: LonLat = [input.fix.longitude, input.fix.latitude];

  if (anchorAlarm?.active) {
    const drift = distanceNm([anchorAlarm.longitude, anchorAlarm.latitude], pos);
    const sogKn = input.fix.speedKn;
    const sogKnown = sogKn != null && Number.isFinite(sogKn);
    const sogDrag = sogKnown && sogKn > ANCHOR_SOG_KN;
    runtime.anchorSogStreak = sogDrag ? runtime.anchorSogStreak + 1 : 0;
    const radiusDrag = drift > anchorAlarm.radiusNm;
    const sustainedSogDrag =
      runtime.anchorSogStreak >= ANCHOR_SOG_STREAK && drift >= ANCHOR_SOG_MIN_DRIFT_NM;

    if (radiusDrag || sustainedSogDrag) {
      const reason = radiusDrag
        ? t('alarms.anchorDragBody', { nm: drift.toFixed(2) })
        : t('alarms.anchorSogBody', { kn: (sogKn ?? 0).toFixed(1) });
      if (!anchorAlarm.triggered) {
        anchorAlarm = { ...anchorAlarm, triggered: true };
        runtime.lastCriticalPulseMs = now;
        actions.push({ type: 'set_anchor_triggered', triggered: true });
        actions.push({
          type: 'trigger',
          severity: 'critical',
          message: `${t('alarms.anchorDragTitle')}: ${reason}`,
        });
      } else if (now - runtime.lastCriticalPulseMs > ANCHOR_REPEAT_MS) {
        runtime.lastCriticalPulseMs = now;
        actions.push({
          type: 'trigger',
          severity: 'critical',
          message: `${t('alarms.anchorDragTitle')}: ${reason}`,
        });
      }
    }
    // Critical anchor alarms stay latched until the user clears the anchor watch.
  } else {
    runtime.anchorSogStreak = 0;
  }

  const target = input.goToTarget;
  if (target) {
    const dist = distanceNm(pos, [target.longitude, target.latitude]);
    const detail = input.passageDetail;
    const legIdx =
      detail && detail.legs.length > 0 ? Math.min(input.activeLegIndex, detail.legs.length - 1) : null;
    const skipArrival =
      Boolean(input.activePassageId && detail && legIdx != null) &&
      legIdx! < detail!.legs.length - 1 &&
      target.id === detail!.legs[legIdx!].to.id;

    if (!skipArrival && dist <= input.alarmLimits.arrivalNm && runtime.arrivalFiredTargetId !== target.id) {
      runtime.arrivalFiredTargetId = target.id;
      actions.push({
        type: 'trigger',
        severity: 'warning',
        message: `${t('alarms.arrivalTitle')}: ${t('alarms.arrivalBody', { name: target.name, nm: dist.toFixed(2) })}`,
      });
    } else if (dist > input.alarmLimits.arrivalNm * 2) {
      runtime.arrivalFiredTargetId = null;
    }
  }

  const detail = input.passageDetail;
  if (detail && detail.legs.length > 0 && input.activePassageId) {
    const legIdx = Math.min(input.activeLegIndex, detail.legs.length - 1);
    const leg = detail.legs[legIdx];

    if (runtime.xteLegIdx !== legIdx) {
      runtime.xteLegIdx = legIdx;
      runtime.xteFired = false;
    }

    const xte = Math.abs(
      crossTrackErrorNm(pos, [leg.from.longitude, leg.from.latitude], [leg.to.longitude, leg.to.latitude]),
    );
    if (xte > input.alarmLimits.xteNm) {
      if (!runtime.xteFired) {
        runtime.xteFired = true;
        actions.push({
          type: 'trigger',
          severity: 'warning',
          message: `${t('alarms.xteTitle')}: ${t('alarms.xteBody', { nm: xte.toFixed(2) })}`,
        });
      }
    } else {
      runtime.xteFired = false;
    }

    const distToWp = distanceNm(pos, [leg.to.longitude, leg.to.latitude]);
    if (distToWp <= input.alarmLimits.arrivalNm && legIdx < detail.legs.length - 1) {
      if (input.legAdvanceAuto) {
        if (runtime.lastAutoAdvancedLegIdx !== legIdx) {
          runtime.lastAutoAdvancedLegIdx = legIdx;
          actions.push({ type: 'leg_advance_auto', legIndex: legIdx + 1, waypointName: leg.to.name });
        }
        runtime.legAdvancePromptLegIdx = null;
      } else if (input.allowLegAdvancePrompt && runtime.legAdvancePromptLegIdx !== legIdx) {
        runtime.legAdvancePromptLegIdx = legIdx;
      }
    } else if (distToWp > input.alarmLimits.arrivalNm * 2) {
      runtime.legAdvancePromptLegIdx = null;
      runtime.lastAutoAdvancedLegIdx = null;
    }
  }

  return { actions, runtime, anchorAlarm };
}

export function freshAlarmRuntime(): AlarmRuntimeState {
  return { ...DEFAULT_ALARM_RUNTIME };
}
