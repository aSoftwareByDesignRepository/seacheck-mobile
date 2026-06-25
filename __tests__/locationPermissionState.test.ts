import {
  isLocationPermissionBlocked,
  isReducedLocationAccuracy,
  mapSnapshotToPermissionState,
  type LocationPermissionSnapshot,
} from '../src/lib/permissions/locationPermissionState';

describe('locationPermissionState', () => {
  describe('isLocationPermissionBlocked', () => {
    it('returns true when denied and cannot ask again', () => {
      expect(
        isLocationPermissionBlocked({
          status: 'denied',
          canAskAgain: false,
        }),
      ).toBe(true);
    });

    it('returns false when denied but can ask again', () => {
      expect(
        isLocationPermissionBlocked({
          status: 'denied',
          canAskAgain: true,
        }),
      ).toBe(false);
    });

    it('returns false when granted', () => {
      expect(
        isLocationPermissionBlocked({
          status: 'granted',
          canAskAgain: false,
        }),
      ).toBe(false);
    });
  });

  describe('isReducedLocationAccuracy', () => {
    it('detects iOS reduced accuracy', () => {
      expect(
        isReducedLocationAccuracy({
          status: 'granted',
          canAskAgain: true,
          expires: 'never',
          granted: true,
          ios: { accuracy: 'reduced' },
        }),
      ).toBe(true);
    });

    it('detects Android coarse accuracy', () => {
      expect(
        isReducedLocationAccuracy({
          status: 'granted',
          canAskAgain: true,
          expires: 'never',
          granted: true,
          android: { accuracy: 'coarse' },
        }),
      ).toBe(true);
    });

    it('returns false for full fine accuracy', () => {
      expect(
        isReducedLocationAccuracy({
          status: 'granted',
          canAskAgain: true,
          expires: 'never',
          granted: true,
          ios: { accuracy: 'full' },
        }),
      ).toBe(false);
    });
  });

  describe('mapSnapshotToPermissionState', () => {
    function snapshot(partial: Partial<LocationPermissionSnapshot>): LocationPermissionSnapshot {
      return {
        foreground: 'undetermined',
        background: 'undetermined',
        foregroundCanAskAgain: true,
        backgroundCanAskAgain: true,
        reducedAccuracy: false,
        ...partial,
      };
    }

    it('maps denied foreground', () => {
      expect(mapSnapshotToPermissionState(snapshot({ foreground: 'denied' }))).toBe('denied');
    });

    it('maps undetermined foreground', () => {
      expect(mapSnapshotToPermissionState(snapshot({}))).toBe('undetermined');
    });

    it('maps foreground-only grant', () => {
      expect(
        mapSnapshotToPermissionState(
          snapshot({
            foreground: 'granted',
            background: 'denied',
          }),
        ),
      ).toBe('foreground');
    });

    it('maps background grant', () => {
      expect(
        mapSnapshotToPermissionState(
          snapshot({
            foreground: 'granted',
            background: 'granted',
          }),
        ),
      ).toBe('background');
    });
  });
});
