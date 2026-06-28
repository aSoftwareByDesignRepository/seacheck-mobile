import { ANCHOR_SOG_MIN_DRIFT_NM, MAX_ALARM_ACCURACY_M } from '../geo/fixQuality';
import { crossTrackErrorNm, distanceNm, type LonLat } from '../geo/navigation';
import { computePassageLegAdvance, shouldResetLegArrivalLatch, assessLegWaypointArrival } from '../passage/legArrival';
import { t } from '../../i18n';
import type { DistanceUnit } from '../../settings/defaults';
import type { PassageWithLegs } from '../../store/passageStore';
import type { AlarmLimits, AnchorAlarmState, NavigationTarget } from '../../store/navigationStore';
import { formatDistanceLineFromNm, formatXteLineFromNm } from '../geo/units';
import { DEFAULT_ALARM_RUNTIME, type AlarmRuntimeState } from './alarmRuntimeState';

/** Re-fire anchor GPS-lost warning at this interval while fix is stale. */
export const ANCHOR_GPS_LOST_REPEAT_MS = 60_000;

/** Sustained SOG readings above this (kn) while at anchor trigger drag alarm. */
export const ANCHOR_SOG_KN = 0.5;

/** Consecutive GPS updates required before SOG drag alarm fires. */
export const ANCHOR_SOG_STREAK = 3;

/** Consecutive fixes outside the anchor circle before radius drag fires. */
export const ANCHOR_RADIUS_STREAK = 2;

/** Re-fire critical anchor alarm at this interval while triggered. */
export const ANCHOR_REPEAT_MS = 45_000;

export type LocationFixInput = {
  latitude: number;
  longitude: number;
  speedKn: number | null;
  /** Horizontal accuracy (m). Drag evaluation is skipped when worse than MAX_ALARM_ACCURACY_M. */
  accuracyM?: number | null;
};

/** Anchor drag requires known horizontal accuracy within the safety limit. */
function isAccuracyTrustworthyForDrag(accuracyM: number | null | undefined): boolean {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return false;
  return accuracyM <= MAX_ALARM_ACCURACY_M;
}

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
  /** Display unit for distance alarm copy — limits stay in NM internally. */
  distanceUnit?: DistanceUnit;
  /** First accepted fix after a GPS gap — skip anchor drag until a second fix confirms position. */
  deferAnchorDragEvaluation?: boolean;
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

  if (anchorAlarm?.active && input.deferAnchorDragEvaluation) {
    // GPS just recovered — do not compare against pre-outage position on a single fix.
    runtime.anchorSogStreak = 0;
    runtime.anchorRadiusStreak = 0;
  } else if (anchorAlarm?.active && !isAccuracyTrustworthyForDrag(input.fix.accuracyM)) {
    // Low-confidence fix: do not evaluate drag (avoids false critical alarms from GPS noise).
    // Streak is reset so a burst of poor fixes cannot accumulate a phantom SOG drag.
    runtime.anchorSogStreak = 0;
    runtime.anchorRadiusStreak = 0;
  } else if (anchorAlarm?.active) {
    const drift = distanceNm([anchorAlarm.longitude, anchorAlarm.latitude], pos);
    const sogKn = input.fix.speedKn;
    const sogKnown = sogKn != null && Number.isFinite(sogKn);
    const sogDrag = sogKnown && sogKn > ANCHOR_SOG_KN;
    runtime.anchorSogStreak = sogDrag ? runtime.anchorSogStreak + 1 : 0;
    const outsideRadius = drift > anchorAlarm.radiusNm;
    runtime.anchorRadiusStreak = outsideRadius ? runtime.anchorRadiusStreak + 1 : 0;
    const radiusDrag = runtime.anchorRadiusStreak >= ANCHOR_RADIUS_STREAK;
    const sustainedSogDrag =
      runtime.anchorSogStreak >= ANCHOR_SOG_STREAK && drift >= ANCHOR_SOG_MIN_DRIFT_NM;

    if (radiusDrag || sustainedSogDrag) {
      const unit = input.distanceUnit ?? 'nm';
      const reason = radiusDrag
        ? t('alarms.anchorDragBody', {
            dist: formatDistanceLineFromNm(drift, unit) ?? drift.toFixed(2),
          })
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
    runtime.anchorRadiusStreak = 0;
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
      const unit = input.distanceUnit ?? 'nm';
      actions.push({
        type: 'trigger',
        severity: 'warning',
        message: `${t('alarms.arrivalTitle')}: ${t('alarms.arrivalBody', {
          name: target.name,
          dist: formatDistanceLineFromNm(dist, unit) ?? dist.toFixed(2),
        })}`,
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
      if (runtime.lastAutoAdvancedLegIdx != null && runtime.lastAutoAdvancedLegIdx >= legIdx) {
        runtime.lastAutoAdvancedLegIdx = null;
      }
      if (runtime.legAdvancePromptLegIdx != null && runtime.legAdvancePromptLegIdx >= legIdx) {
        runtime.legAdvancePromptLegIdx = null;
      }
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
          message: `${t('alarms.xteTitle')}: ${t('alarms.xteBody', {
            dist: formatXteLineFromNm(xte, input.distanceUnit ?? 'nm') ?? xte.toFixed(2),
          })}`,
        });
      }
    } else {
      runtime.xteFired = false;
    }

    const legAdvance = computePassageLegAdvance(pos, detail.legs, legIdx, input.alarmLimits.arrivalNm);
    if (legAdvance && legIdx < detail.legs.length - 1) {
      if (input.legAdvanceAuto) {
        if (runtime.lastAutoAdvancedLegIdx == null || runtime.lastAutoAdvancedLegIdx < legAdvance.completedLegIndex) {
          runtime.lastAutoAdvancedLegIdx = legAdvance.completedLegIndex;
          actions.push({
            type: 'leg_advance_auto',
            legIndex: legAdvance.nextLegIndex,
            waypointName: legAdvance.waypointName,
          });
        }
        runtime.legAdvancePromptLegIdx = null;
      } else if (input.allowLegAdvancePrompt && runtime.legAdvancePromptLegIdx !== legAdvance.completedLegIndex) {
        runtime.legAdvancePromptLegIdx = legAdvance.completedLegIndex;
      }
    } else {
      const currentAssessment = assessLegWaypointArrival(
        pos,
        [leg.from.longitude, leg.from.latitude],
        [leg.to.longitude, leg.to.latitude],
        input.alarmLimits.arrivalNm,
      );
      if (shouldResetLegArrivalLatch(currentAssessment, input.alarmLimits.arrivalNm)) {
        runtime.legAdvancePromptLegIdx = null;
        if (runtime.lastAutoAdvancedLegIdx != null && runtime.lastAutoAdvancedLegIdx >= legIdx) {
          runtime.lastAutoAdvancedLegIdx = null;
        }
      }
    }
  }

  return { actions, runtime, anchorAlarm };
}

export function freshAlarmRuntime(): AlarmRuntimeState {
  return { ...DEFAULT_ALARM_RUNTIME };
}
