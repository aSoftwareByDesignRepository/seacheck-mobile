import { formatDateTimeLocal, formatDateLocal } from '../src/lib/time/formatDateTimeLocal';

describe('formatDateTimeLocal', () => {
  it('formats epoch ms using device locale', () => {
    const ms = Date.UTC(2026, 5, 15, 14, 30);
    const formatted = formatDateTimeLocal(ms);
    expect(formatted).toBe(new Date(ms).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }));
    expect(formatted).not.toMatch(/UTC/i);
  });

  it('returns dash for invalid dates', () => {
    expect(formatDateTimeLocal(Number.NaN)).toBe('—');
    expect(formatDateLocal(Number.NaN)).toBe('—');
  });
});
