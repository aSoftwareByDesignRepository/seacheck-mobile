import {
  buildMaydayMessage,
  formatMmsiForMayday,
  isValidMmsi,
  sanitizeVesselField,
} from '../src/lib/emergency/maydayMessage';
import type { LocationFix } from '../src/services/locationService';

describe('maydayMessage', () => {
  const fix = (overrides: Partial<LocationFix> = {}): LocationFix => ({
    latitude: 54.32,
    longitude: 10.12,
    heading: null,
    cogDeg: null,
    speedMs: 0,
    speedKn: 0,
    accuracyM: 10,
    altitudeM: null,
    timestamp: Date.now(),
    ...overrides,
  });

  it('accepts valid nine-digit MMSI', () => {
    expect(isValidMmsi('211234567')).toBe(true);
    expect(formatMmsiForMayday('211 234 567')).toBe('211234567');
  });

  it('rejects invalid MMSI', () => {
    expect(isValidMmsi('12345')).toBe(false);
    expect(formatMmsiForMayday('not-a-mmsi')).toBeNull();
  });

  it('strips control characters from vessel fields', () => {
    expect(sanitizeVesselField('Sea\nBreeze')).toBe('Sea Breeze');
  });

  it('includes fix age for fresh positions', () => {
    const message = buildMaydayMessage(
      { name: 'Test', callSign: 'DL1TST', mmsi: '211234567', homePort: 'Kiel' },
      fix({ timestamp: Date.now() - 5000 }),
      'ddm',
    );
    expect(message).toContain('MMSI: 211234567');
    expect(message).toMatch(/GPS \d+ s ago/);
  });

  it('omits invalid MMSI from distress text', () => {
    const message = buildMaydayMessage(
      { name: 'Test', callSign: '', mmsi: 'bad', homePort: '' },
      fix(),
      'dd',
    );
    expect(message).not.toContain('MMSI');
  });

  it('marks stale coordinates in the message', () => {
    const message = buildMaydayMessage(
      { name: 'Test', callSign: '', mmsi: '', homePort: '' },
      fix({ timestamp: Date.now() - 60_000 }),
      'dd',
    );
    expect(message).toContain('Last known position');
  });
});
