import {
  ANCHOR_SOG_KN,
  ANCHOR_SOG_STREAK,
  freshAlarmRuntime,
  processLocationAlarms,
} from '../src/lib/alarms/processLocationAlarms';

describe('processLocationAlarms', () => {
  it('fires anchor drag when drift exceeds radius', () => {
    const result = processLocationAlarms({
      fix: { latitude: 54.01, longitude: 10.01, speedKn: 0 },
      anchorAlarm: { active: true, latitude: 54, longitude: 10, radiusNm: 0.05, triggered: false },
      goToTarget: null,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
      activePassageId: null,
      activeLegIndex: 0,
      passageDetail: null,
      legAdvanceAuto: false,
      allowLegAdvancePrompt: true,
      runtime: freshAlarmRuntime(),
    });

    expect(result.actions.some((a) => a.type === 'trigger' && a.severity === 'critical')).toBe(true);
    expect(result.anchorAlarm?.triggered).toBe(true);
  });

  it('fires anchor drag after sustained SOG at anchor', () => {
    let runtime = freshAlarmRuntime();
    const anchor = { active: true, latitude: 54, longitude: 10, radiusNm: 0.05, triggered: false };

    for (let i = 0; i < ANCHOR_SOG_STREAK; i++) {
      const out = processLocationAlarms({
        fix: { latitude: 54.0001, longitude: 10.0001, speedKn: ANCHOR_SOG_KN + 0.2 },
        anchorAlarm: anchor,
        goToTarget: null,
        alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
        activePassageId: null,
        activeLegIndex: 0,
        passageDetail: null,
        legAdvanceAuto: false,
        allowLegAdvancePrompt: true,
        runtime,
      });
      runtime = out.runtime;
      if (i < ANCHOR_SOG_STREAK - 1) {
        expect(out.actions.length).toBe(0);
      }
    }

    const final = processLocationAlarms({
      fix: { latitude: 54.0001, longitude: 10.0001, speedKn: ANCHOR_SOG_KN + 0.2 },
      anchorAlarm: anchor,
      goToTarget: null,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
      activePassageId: null,
      activeLegIndex: 0,
      passageDetail: null,
      legAdvanceAuto: false,
      allowLegAdvancePrompt: true,
      runtime,
    });

    expect(final.actions.some((a) => a.type === 'trigger')).toBe(true);
  });

  it('keeps anchor triggered latched when back inside radius', () => {
    const triggered = { active: true, latitude: 54, longitude: 10, radiusNm: 0.05, triggered: true };
    const result = processLocationAlarms({
      fix: { latitude: 54.00001, longitude: 10.00001, speedKn: 0 },
      anchorAlarm: triggered,
      goToTarget: null,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
      activePassageId: null,
      activeLegIndex: 0,
      passageDetail: null,
      legAdvanceAuto: false,
      allowLegAdvancePrompt: true,
      runtime: freshAlarmRuntime(),
    });

    expect(result.actions.some((a) => a.type === 'set_anchor_triggered')).toBe(false);
    expect(result.anchorAlarm?.triggered).toBe(true);
  });

  it('auto-advances leg only once per leg index', () => {
    const wp = (id: string, name: string, lat: number, lon: number) => ({
      id,
      name,
      latitude: lat,
      longitude: lon,
      type: 'generic' as const,
      created_at: 0,
      updated_at: 0,
    });
    const passageDetail = {
      id: 'p1',
      waypoints: [wp('a', 'A', 54.32, 10.12), wp('b', 'B', 54.321, 10.121), wp('c', 'C', 54.33, 10.13)],
      legs: [
        {
          index: 1,
          from: wp('a', 'A', 54.32, 10.12),
          to: wp('b', 'B', 54.321, 10.121),
          distanceNm: 0.05,
          bearingDeg: 90,
          durationHours: 1,
          etaUtc: null,
        },
        {
          index: 2,
          from: wp('b', 'B', 54.321, 10.121),
          to: wp('c', 'C', 54.33, 10.13),
          distanceNm: 0.5,
          bearingDeg: 45,
          durationHours: 1,
          etaUtc: null,
        },
      ],
      totalNm: 0.05,
      totalHours: 1,
      default_sog_kn: 5,
      planned_departure: null,
      is_active: 1,
      created_at: 0,
      updated_at: 0,
      name: 'Test',
    };

    const base = {
      fix: { latitude: 54.321, longitude: 10.121, speedKn: 4 },
      anchorAlarm: null,
      goToTarget: null,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.1 },
      activePassageId: 'p1',
      activeLegIndex: 0,
      passageDetail,
      legAdvanceAuto: true,
      allowLegAdvancePrompt: false,
      runtime: freshAlarmRuntime(),
    };

    const first = processLocationAlarms(base);
    expect(first.actions.filter((a) => a.type === 'leg_advance_auto')).toHaveLength(1);

    const second = processLocationAlarms({ ...base, runtime: first.runtime });
    expect(second.actions.filter((a) => a.type === 'leg_advance_auto')).toHaveLength(0);
  });
});
