import { parseAlarmLimitDisplay } from '../src/lib/alarms/alarmLimits';
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

describe('distanceToNm', () => {
  it('converts km to NM', () => {
    expect(distanceToNm(1.852, 'km')).toBeCloseTo(1, 3);
  });
});
