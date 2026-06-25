import { ALARM_LIMIT_MAX_NM, ALARM_LIMIT_MIN_NM, parseAlarmLimitNm } from '../src/lib/alarms/alarmLimits';

describe('parseAlarmLimitNm', () => {
  it('parses decimal comma and dot', () => {
    expect(parseAlarmLimitNm('0,05', 0.1)).toBe(0.05);
    expect(parseAlarmLimitNm('0.1', 0.05)).toBe(0.1);
  });

  it('clamps to min and max', () => {
    expect(parseAlarmLimitNm('0', 0.05)).toBe(ALARM_LIMIT_MIN_NM);
    expect(parseAlarmLimitNm('99', 0.05)).toBe(ALARM_LIMIT_MAX_NM);
  });

  it('returns fallback for empty or invalid input', () => {
    expect(parseAlarmLimitNm('', 0.05)).toBe(0.05);
    expect(parseAlarmLimitNm('abc', 0.05)).toBe(0.05);
  });
});
