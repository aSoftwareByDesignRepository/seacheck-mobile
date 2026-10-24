import { formatDateLocal, formatDateTimeLocal } from '../src/lib/time/formatDateTimeLocal';
import { formatEtaLocalFromIso } from '../src/lib/time/formatEta';

// Timezone boundary probes (ATLAS tz-matrix): instant renderers must follow
// the DEVICE zone across the UTC-midnight boundary. The bug class this pins
// is a UTC-pinned or previous-day-shifted render — a date-only `YYYY-MM-DD`
// parse would render the wrong day in one of the probe zones.
//
// 2026-07-02T02:00:00Z is:
//   America/New_York   (UTC-4):  Jul 1, 22:00
//   Europe/Berlin      (UTC+2):  Jul 2, 04:00
//   Pacific/Kiritimati (UTC+14): Jul 2, 16:00
const BOUNDARY_MS = Date.UTC(2026, 6, 2, 2, 0);
const BOUNDARY_ISO = '2026-07-02T02:00:00.000Z';
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' } as const;
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

function inZone(timeZone: string, opts: Intl.DateTimeFormatOptions, ms: number): string {
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(new Date(ms));
}

describe('tz boundary: instant renderers track the device zone', () => {
  it('formatDateLocal renders the device-zone calendar day, not the UTC day', () => {
    const rendered = formatDateLocal(BOUNDARY_MS);
    // Oracle 1: identical to an explicit-timezone Intl render of the same
    // instant — proves local-zone rendering, never a pinned UTC day.
    expect(rendered).toBe(inZone(ZONE, DATE_OPTS, BOUNDARY_MS));
    // Oracle 2 (UTC-pin detector): wherever the local day differs from the
    // UTC day, the render must differ too.
    const utcDay = inZone('UTC', DATE_OPTS, BOUNDARY_MS);
    const localDay = inZone(ZONE, DATE_OPTS, BOUNDARY_MS);
    if (utcDay !== localDay) {
      expect(rendered).not.toBe(utcDay);
    }
  });

  it('formatEtaLocalFromIso renders the device-zone wall time', () => {
    const rendered = formatEtaLocalFromIso(BOUNDARY_ISO);
    expect(rendered).not.toBeNull();
    expect(rendered).toBe(inZone(ZONE, TIME_OPTS, BOUNDARY_MS));
    const utcWall = inZone('UTC', TIME_OPTS, BOUNDARY_MS);
    const localWall = inZone(ZONE, TIME_OPTS, BOUNDARY_MS);
    if (utcWall !== localWall) {
      expect(rendered).not.toBe(utcWall);
    }
  });

  it('formatDateTimeLocal stays instant-consistent across the boundary', () => {
    const rendered = formatDateTimeLocal(BOUNDARY_MS);
    expect(rendered).toBe(
      new Date(BOUNDARY_MS).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );
    expect(rendered).not.toMatch(/UTC/i);
  });
});
