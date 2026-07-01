import { formatEtaAheadHours, formatEtaLocalFromIso, formatTimeLocal } from '../src/lib/time/formatEta';

describe('formatEta', () => {
  it('formats ISO UTC as local time without UTC suffix', () => {
    const iso = '2026-07-01T14:30:00.000Z';
    const local = formatEtaLocalFromIso(iso);
    expect(local).toBe(formatTimeLocal(new Date(iso)));
    expect(local).not.toMatch(/UTC/i);
  });

  it('returns null for invalid input', () => {
    expect(formatEtaLocalFromIso(null)).toBeNull();
    expect(formatEtaLocalFromIso('')).toBeNull();
    expect(formatEtaAheadHours(0)).toBeNull();
    expect(formatEtaAheadHours(-1)).toBeNull();
  });

  it('formats hours-ahead ETA at reference time', () => {
    const ref = Date.parse('2026-07-01T12:00:00.000Z');
    const eta = formatEtaAheadHours(2, ref);
    expect(eta).toBe(formatTimeLocal(new Date(ref + 2 * 3_600_000)));
  });
});
