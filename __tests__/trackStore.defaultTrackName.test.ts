jest.mock('../src/lib/db/database', () => ({
  getDatabase: jest.fn(async () => ({
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
  })),
  newId: jest.fn((prefix: string) => `${prefix}-test`),
}));

jest.mock('../src/services/trackLiveTrail', () => ({
  registerTrackLiveTrail: jest.fn(),
}));

jest.mock('../src/services/backgroundLocationService', () => ({
  syncRecordingBackgroundGps: jest.fn(async () => {}),
}));

import { buildDefaultTrackName } from '../src/store/trackStore';
import { formatDateLocal } from '../src/lib/time/formatDateTimeLocal';

describe('buildDefaultTrackName', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('names the track with the device-local calendar date, not the UTC slice', () => {
    // 2026-10-24T23:30Z is Oct 24 in UTC but Oct 25 already east of UTC+1 —
    // a toISOString().slice(0,10) name would label the track with the wrong day.
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T23:30:00.000Z'));
    const name = buildDefaultTrackName();
    const localDay = formatDateLocal(new Date());
    expect(name).toContain(localDay);
    // Pin the shared local-date module: an ISO YYYY-MM-DD slice must not return.
    expect(name).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('falls back to the translated default when no passage is active', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
    const name = buildDefaultTrackName();
    expect(name.trim().length).toBeGreaterThan(0);
    expect(name).not.toBe('—');
  });
});
