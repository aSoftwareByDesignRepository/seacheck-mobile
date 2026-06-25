import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';

import { getDatabase, type PassageRow, type WaypointRow } from '../db/database';
import { FIX_STALE_MS } from '../geo/fixAge';
import { classifyFixAcceptance } from '../geo/gpsFilter';
import { loadAlarmRuntime, saveAlarmRuntime } from './alarmRuntimeState';
import { ANCHOR_GPS_LOST_REPEAT_MS, processLocationAlarms } from './processLocationAlarms';
import { computePassageLegs, legOverrideKey, type LegOverride } from '../passage/computeLegs';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import type { AlarmLimits, AnchorAlarmState, NavigationTarget } from '../../store/navigationStore';
import { triggerMaritimeAlarm } from '../../services/alarmFeedbackService';

export const NAV_STORAGE_KEY = 'seacheck.navigation.v1';
const SETTINGS_STORAGE_KEY = 'seacheck.settings.v1';

function navigationStore() {
  return require('../../store/navigationStore').useNavigationStore as typeof import('../../store/navigationStore').useNavigationStore;
}

function passageStore() {
  return require('../../store/passageStore').usePassageStore as typeof import('../../store/passageStore').usePassageStore;
}

type NavPersist = {
  goToTarget: NavigationTarget | null;
  anchorAlarm: AnchorAlarmState | null;
  activeLegIndex: number;
  alarmLimits: AlarmLimits;
};

type SettingsPersist = {
  legAdvanceAuto?: boolean;
  backgroundTrackRecording?: boolean;
};

export type AlarmLiveState = {
  anchorAlarm: AnchorAlarmState | null;
  goToTarget: NavigationTarget | null;
  alarmLimits: AlarmLimits;
  activeLegIndex: number;
  activePassageId: string | null;
  passageDetail: PassageWithLegs | null;
  legAdvanceAuto: boolean;
};

export type ProcessFixOptions = {
  allowLegAdvancePrompt: boolean;
  inBackground: boolean;
  /** When the UI stores are hydrated, pass live Zustand state to avoid stale AsyncStorage reads. */
  liveState?: AlarmLiveState;
};

export type ProcessFixResult = {
  legAdvancePromptLegIdx: number | null;
};

let processChain: Promise<void> = Promise.resolve();

/** Serializes alarm processing so foreground hooks and background tasks share one runtime writer. */
function enqueueAlarmProcessing<T>(fn: () => Promise<T>): Promise<T> {
  const next = processChain.then(fn);
  processChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function loadNavPersist(): Promise<NavPersist | null> {
  const raw = await AsyncStorage.getItem(NAV_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NavPersist;
  } catch {
    return null;
  }
}

export async function loadSettingsPersist(): Promise<SettingsPersist | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SettingsPersist;
  } catch {
    return null;
  }
}

async function loadActivePassageId(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM passages WHERE is_active = 1 LIMIT 1');
  return row?.id ?? null;
}

async function fetchPassageDetailById(id: string): Promise<PassageWithLegs | null> {
  const db = await getDatabase();
  const passage = await db.getFirstAsync<PassageRow>('SELECT * FROM passages WHERE id = ?', id);
  if (!passage) return null;

  const waypoints = await db.getAllAsync<WaypointRow>(
    `SELECT w.* FROM waypoints w
     INNER JOIN passage_waypoints pw ON pw.waypoint_id = w.id
     WHERE pw.passage_id = ?
     ORDER BY pw.sort_order ASC`,
    id,
  );

  const overrideRows = await db.getAllAsync<{
    from_waypoint_id: string;
    to_waypoint_id: string;
    sog_kn: number | null;
    note: string | null;
  }>('SELECT * FROM passage_leg_overrides WHERE passage_id = ?', id);

  const overrides: Record<string, LegOverride> = {};
  for (const row of overrideRows) {
    overrides[legOverrideKey(row.from_waypoint_id, row.to_waypoint_id)] = {
      sogKn: row.sog_kn ?? undefined,
      note: row.note || undefined,
    };
  }

  const legs = computePassageLegs(waypoints, passage.default_sog_kn, passage.planned_departure, overrides);
  const totalNm = legs.reduce((sum, l) => sum + l.distanceNm, 0);
  const totalHours = legs.reduce((sum, l) => sum + l.durationHours, 0);

  return { ...passage, waypoints, legs, totalNm, totalHours };
}

async function persistLegAdvanceFromBackground(legIndex: number, passageId: string): Promise<void> {
  const detail = await fetchPassageDetailById(passageId);
  if (!detail || detail.legs.length === 0) return;
  const idx = Math.min(Math.max(0, legIndex), detail.legs.length - 1);

  if (passageStore().getState().hydrated && passageStore().getState().activePassageId === passageId) {
    await passageStore().getState().setPassageActiveLeg(legIndex, { resetTimer: false });
    return;
  }

  const leg = detail.legs[idx];
  const goTo = {
    id: leg.to.id,
    name: leg.to.name,
    latitude: leg.to.latitude,
    longitude: leg.to.longitude,
    kind: 'waypoint' as const,
  };

  const raw = await AsyncStorage.getItem(NAV_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.activeLegIndex = idx;
    parsed.goToTarget = goTo;
    parsed.legTimerStartedAtMs = Date.now();
    await AsyncStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* keep prior nav state */
  }
}

function mapLocationToFix(loc: Location.LocationObject) {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    speedKn: loc.coords.speed != null ? loc.coords.speed * 1.94384 : null,
    accuracyM: loc.coords.accuracy ?? null,
    timestamp: loc.timestamp ?? Date.now(),
  };
}

/**
 * Previous fix accepted for alarm evaluation. Used to reject single-fix GNSS spikes (multipath)
 * before they reach drag / XTE / arrival logic. Shared by foreground hook and background task
 * via the serialized processing chain, so no concurrent mutation occurs.
 */
let lastAlarmFix: {
  latitude: number;
  longitude: number;
  speedKn: number | null;
  accuracyM: number | null;
  timestamp: number;
} | null = null;

/** Test-only — clears the outlier-detection memory between cases. */
export function resetAlarmFixHistoryForTests(): void {
  lastAlarmFix = null;
}

async function resolveAlarmInputs(options: ProcessFixOptions): Promise<{
  navPersist: NavPersist;
  settings: SettingsPersist;
  activePassageId: string | null;
  passageDetail: PassageWithLegs | null;
  legAdvanceAuto: boolean;
}> {
  const live = options.liveState;
  if (live) {
    return {
      navPersist: {
        goToTarget: live.goToTarget,
        anchorAlarm: live.anchorAlarm,
        activeLegIndex: live.activeLegIndex,
        alarmLimits: live.alarmLimits,
      },
      settings: { legAdvanceAuto: live.legAdvanceAuto },
      activePassageId: live.activePassageId,
      passageDetail: live.passageDetail,
      legAdvanceAuto: live.legAdvanceAuto,
    };
  }

  const navPersist = (await loadNavPersist()) ?? {
    goToTarget: null,
    anchorAlarm: null,
    activeLegIndex: 0,
    alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
  };
  const settings = (await loadSettingsPersist()) ?? {};
  const activePassageId = await loadActivePassageId();
  const passageDetail = activePassageId ? await fetchPassageDetailById(activePassageId) : null;
  return {
    navPersist,
    settings,
    activePassageId,
    passageDetail,
    legAdvanceAuto: Boolean(settings.legAdvanceAuto),
  };
}

/** Single entry point for maritime alarms — foreground hook and background GPS task. */
export async function processFixFromLocation(
  loc: Location.LocationObject,
  options: ProcessFixOptions,
): Promise<ProcessFixResult> {
  return enqueueAlarmProcessing(async () => {
    const fixTs = loc.timestamp ?? Date.now();
    const { navPersist, activePassageId, passageDetail, legAdvanceAuto } = await resolveAlarmInputs(options);
    const runtime = await loadAlarmRuntime();
    const mappedFix = mapLocationToFix(loc);

    if (navPersist.anchorAlarm?.active && Date.now() - fixTs > FIX_STALE_MS) {
      const now = Date.now();
      if (now - runtime.lastAnchorGpsWarnMs > ANCHOR_GPS_LOST_REPEAT_MS) {
        runtime.lastAnchorGpsWarnMs = now;
        await saveAlarmRuntime(runtime);
        await triggerMaritimeAlarm('warning', t('alarms.anchorGpsSuspended'), { inBackground: options.inBackground });
      }
      return { legAdvancePromptLegIdx: null };
    }

    // Reject single-fix GNSS spikes (multipath / invalid / poor accuracy) before drag/XTE/arrival
    // evaluation so they cannot fire a false critical alarm. The raw fix is still used elsewhere
    // for display; here only trustworthy fixes drive safety alarms.
    const acceptance = classifyFixAcceptance(lastAlarmFix, {
      latitude: mappedFix.latitude,
      longitude: mappedFix.longitude,
      timestamp: mappedFix.timestamp,
      speedKn: mappedFix.speedKn,
      accuracyM: mappedFix.accuracyM,
    });
    if (!acceptance.accepted) {
      return { legAdvancePromptLegIdx: runtime.legAdvancePromptLegIdx };
    }
    lastAlarmFix = {
      latitude: mappedFix.latitude,
      longitude: mappedFix.longitude,
      speedKn: mappedFix.speedKn,
      accuracyM: mappedFix.accuracyM,
      timestamp: mappedFix.timestamp,
    };

    const { actions, runtime: nextRuntime, anchorAlarm } = processLocationAlarms({
      fix: mappedFix,
      anchorAlarm: navPersist.anchorAlarm,
      goToTarget: navPersist.goToTarget,
      alarmLimits: navPersist.alarmLimits,
      activePassageId,
      activeLegIndex: navPersist.activeLegIndex,
      passageDetail,
      legAdvanceAuto,
      allowLegAdvancePrompt: options.allowLegAdvancePrompt,
      runtime,
    });

    await saveAlarmRuntime(nextRuntime);

    if (anchorAlarm && anchorAlarm.triggered !== navPersist.anchorAlarm?.triggered) {
      if (navigationStore().getState().hydrated) {
        const current = navigationStore().getState().anchorAlarm;
        if (current?.triggered !== anchorAlarm.triggered) {
          await navigationStore().getState().setAnchorTriggered(anchorAlarm.triggered);
        }
      } else {
        const raw = await AsyncStorage.getItem(NAV_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as NavPersist & Record<string, unknown>;
            parsed.anchorAlarm = anchorAlarm;
            await AsyncStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(parsed));
          } catch {
            /* keep prior nav state */
          }
        }
      }
    }

    for (const action of actions) {
      if (action.type === 'trigger') {
        await triggerMaritimeAlarm(action.severity, action.message, { inBackground: options.inBackground });
      } else if (action.type === 'leg_advance_auto') {
        if (activePassageId) {
          if (passageStore().getState().hydrated && passageStore().getState().activePassageId === activePassageId) {
            await passageStore().getState().setPassageActiveLeg(action.legIndex);
          } else {
            await persistLegAdvanceFromBackground(action.legIndex, activePassageId);
          }
        }
        await triggerMaritimeAlarm('warning', t('alarms.legAdvanced', { name: action.waypointName }), {
          inBackground: options.inBackground,
        });
      }
    }

    return {
      legAdvancePromptLegIdx: options.allowLegAdvancePrompt ? nextRuntime.legAdvancePromptLegIdx : null,
    };
  });
}

export async function isAnchorMonitoringNeeded(): Promise<boolean> {
  const nav = await loadNavPersist();
  return Boolean(nav?.anchorAlarm?.active);
}

export async function isBackgroundTrackNeeded(): Promise<boolean> {
  const trackId = await AsyncStorage.getItem('seacheck.track.recordingId');
  if (!trackId) return false;
  const settings = await loadSettingsPersist();
  return Boolean(settings?.backgroundTrackRecording);
}

export async function shouldRunBackgroundLocation(): Promise<boolean> {
  return (await isAnchorMonitoringNeeded()) || (await isBackgroundTrackNeeded());
}
