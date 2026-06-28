import { parseAlarmLimitDisplay, parseAlarmLimitNm, ALARM_LIMIT_MAX_NM, ALARM_LIMIT_MIN_NM } from '../src/lib/alarms/alarmLimits';
import { distanceToNm } from '../src/lib/geo/units';

describe('parseAlarmLimitDisplay', () => {
  it('parses km input and stores as NM internally', () => {
    expect(parseAlarmLimitDisplay('0.46', 'km', 0.05)).toBeCloseTo(0.25, 2);
  });

  it('parses NM input unchanged', () => {
    expect(parseAlarmLimitDisplay('0.25', 'nm', 0.05)).toBeCloseTo(0.25, 3);
  });

  it('returns fallback for invalid input', () => {
    expect(parseAlarmLimitDisplay('abc', 'km', 0.05)).toBe(0.05);
  });
});

describe('parseAlarmLimitNm', () => {
  it('clamps to minimum NM', () => {
    expect(parseAlarmLimitNm('0.0001', 0.05)).toBe(ALARM_LIMIT_MIN_NM);
  });

  it('clamps to maximum NM', () => {
    expect(parseAlarmLimitNm('99', 0.05)).toBe(ALARM_LIMIT_MAX_NM);
  });

  it('returns fallback for invalid input', () => {
    expect(parseAlarmLimitNm('abc', 0.05)).toBe(0.05);
  });
});

describe('distanceToNm', () => {
  it('converts km to NM', () => {
    expect(distanceToNm(1.852, 'km')).toBeCloseTo(1, 3);
  });
});
