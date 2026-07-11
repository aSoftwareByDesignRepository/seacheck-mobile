import { resolveForegroundGpsProfile } from '../src/lib/geo/foregroundGpsDemand';
import type { ForegroundGpsDemandInput } from '../src/lib/geo/foregroundGpsDemand';
import { foregroundGpsOptionsForProfile } from '../src/lib/geo/gpsLocationOptions';
import {
  needsUnifiedBackgroundGps,
  resetForegroundLocationWatchChainForTests,
  shouldPauseForegroundWatch,
  syncForegroundLocationWatch,
} from '../src/lib/geo/syncForegroundLocationWatch';
import * as Location from 'expo-location';

jest.mock('../src/lib/map/mapScreenFocus', () => ({
  isMapScreenFocused: jest.fn(() => false),
}));

jest.mock('../src/services/backgroundLocationService', () => ({
  isBackgroundLocationRunning: jest.fn(),
}));

jest.mock('../src/services/locationService', () => ({
  useLocationStore: {
    getState: jest.fn(),
  },
}));

jest.mock('../src/store/navigationStore', () => ({
  useNavigationStore: {
    getState: jest.fn(),
  },
}));

jest.mock('../src/store/passageStore', () => ({
  usePassageStore: {
    getState: jest.fn(() => ({ activePassageId: null })),
  },
}));

jest.mock('../src/store/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({ backgroundTrackRecording: false })),
  },
}));

jest.mock('../src/store/trackStore', () => ({
  useTrackStore: {
    getState: jest.fn(() => ({ recordingTrackId: null })),
  },
}));

const { isMapScreenFocused } = require('../src/lib/map/mapScreenFocus') as {
  isMapScreenFocused: jest.Mock;
};
const { isBackgroundLocationRunning } = require('../src/services/backgroundLocationService') as {
  isBackgroundLocationRunning: jest.Mock;
};
const { useLocationStore } = require('../src/services/locationService') as {
  useLocationStore: { getState: jest.Mock };
};
const { useNavigationStore } = require('../src/store/navigationStore') as {
  useNavigationStore: { getState: jest.Mock };
};
const { usePassageStore } = require('../src/store/passageStore') as {
  usePassageStore: { getState: jest.Mock };
};

function baseDemand(overrides: Partial<ForegroundGpsDemandInput> = {}): ForegroundGpsDemandInput {
  return {
    mapScreenFocused: false,
    mobTarget: false,
    goToTargetActive: false,
    recordingTrackId: null,
    backgroundTrackRecording: false,
    locationPermission: 'foreground',
    ...overrides,
  };
}

describe('resolveForegroundGpsProfile', () => {
  it('uses navigation profile for MOB and go-to navigation', () => {
    expect(resolveForegroundGpsProfile(baseDemand({ mobTarget: true }))).toBe('navigation');
    expect(resolveForegroundGpsProfile(baseDemand({ goToTargetActive: true }))).toBe('navigation');
  });

  it('uses navigation profile whenever the map tab is focused', () => {
    expect(resolveForegroundGpsProfile(baseDemand({ mapScreenFocused: true }))).toBe('navigation');
  });

  it('uses idle profile on non-map tabs', () => {
    expect(resolveForegroundGpsProfile(baseDemand({ mapScreenFocused: false }))).toBe('idle');
  });

  it('uses navigation profile for foreground-only track recording', () => {
    expect(resolveForegroundGpsProfile(baseDemand({ recordingTrackId: 'track-1' }))).toBe('navigation');
    expect(
      resolveForegroundGpsProfile(
        baseDemand({
          recordingTrackId: 'track-1',
          backgroundTrackRecording: true,
          locationPermission: 'background',
        }),
      ),
    ).toBe('idle');
  });
});

describe('foregroundGpsOptionsForProfile', () => {
  it('maps navigation to best-for-navigation and idle to high accuracy with longer intervals', () => {
    const navigation = foregroundGpsOptionsForProfile('navigation');
    const idle = foregroundGpsOptionsForProfile('idle');

    expect(navigation.accuracy).toBe(Location.Accuracy.BestForNavigation);
    expect(navigation.timeInterval).toBe(1000);
    expect(idle.accuracy).toBe(Location.Accuracy.High);
    expect(idle.timeInterval).toBeGreaterThanOrEqual(5000);
  });
});

describe('needsUnifiedBackgroundGps', () => {
  beforeEach(() => {
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: null, mobTarget: null, goToTarget: null });
    usePassageStore.getState.mockReturnValue({ activePassageId: null });
  });

  it('requires background permission', () => {
    useLocationStore.getState.mockReturnValue({ permission: 'foreground' });
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: { active: true }, mobTarget: null, goToTarget: null });
    expect(needsUnifiedBackgroundGps()).toBe(false);
  });

  it('does not treat active passage alone as background-eligible', () => {
    usePassageStore.getState.mockReturnValue({ activePassageId: 'passage-1' });
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: null, mobTarget: null, goToTarget: null });
    expect(needsUnifiedBackgroundGps()).toBe(false);
  });

  it('treats standalone go-to as background-eligible', () => {
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: null,
      goToTarget: { id: 'wp-1', kind: 'waypoint' },
    });
    expect(needsUnifiedBackgroundGps()).toBe(true);
  });

  it('treats active passage navigation with a go-to target as background-eligible', () => {
    usePassageStore.getState.mockReturnValue({ activePassageId: 'passage-1' });
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: null, mobTarget: null, goToTarget: { id: 'wp-1' } });
    expect(needsUnifiedBackgroundGps()).toBe(true);
  });

  it('treats MOB navigation as background-eligible with background permission', () => {
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: { id: 'mob-1' },
      goToTarget: { id: 'mob-1' },
    });
    expect(needsUnifiedBackgroundGps()).toBe(true);
  });

  it('treats legacy MOB go-to without mobTarget as background-eligible', () => {
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: null,
      goToTarget: { id: 'mob-1', kind: 'mob' },
    });
    expect(needsUnifiedBackgroundGps()).toBe(true);
  });
});

describe('shouldPauseForegroundWatch', () => {
  beforeEach(() => {
    isMapScreenFocused.mockReturnValue(false);
    isBackgroundLocationRunning.mockResolvedValue(true);
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: null, mobTarget: null, goToTarget: null });
    usePassageStore.getState.mockReturnValue({ activePassageId: null });
  });

  it('never pauses when navigation profile is required (MOB)', async () => {
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: { id: 'mob' },
      goToTarget: null,
    });
    await expect(shouldPauseForegroundWatch('active')).resolves.toBe(false);
    expect(isBackgroundLocationRunning).not.toHaveBeenCalled();
  });

  it('pauses on non-map tabs only when background GPS is actually running', async () => {
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    await expect(shouldPauseForegroundWatch('active')).resolves.toBe(true);

    isBackgroundLocationRunning.mockResolvedValue(false);
    await expect(shouldPauseForegroundWatch('active')).resolves.toBe(false);
  });

  it('keeps foreground watch on the map tab even with background GPS running', async () => {
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    isMapScreenFocused.mockReturnValue(true);
    await expect(shouldPauseForegroundWatch('active')).resolves.toBe(false);
  });

  it('keeps foreground watch when MOB is active but background GPS is not running yet', async () => {
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: { id: 'mob-1' },
      goToTarget: { id: 'mob-1' },
    });
    isBackgroundLocationRunning.mockResolvedValue(false);
    await expect(shouldPauseForegroundWatch('active')).resolves.toBe(false);
  });

  it('keeps limited anchor watch alive in background when only foreground permission is granted', async () => {
    useLocationStore.getState.mockReturnValue({ permission: 'foreground' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    await expect(shouldPauseForegroundWatch('background')).resolves.toBe(false);
  });

  it('keeps foreground MOB watch in background when only foreground permission is granted', async () => {
    useLocationStore.getState.mockReturnValue({ permission: 'foreground' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: { id: 'mob-1' },
      goToTarget: { id: 'mob-1' },
    });
    await expect(shouldPauseForegroundWatch('background')).resolves.toBe(false);
  });

  it('pauses foreground MOB watch in background when unified background GPS is running', async () => {
    useLocationStore.getState.mockReturnValue({ permission: 'background' });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: null,
      mobTarget: { id: 'mob-1' },
      goToTarget: { id: 'mob-1' },
    });
    isBackgroundLocationRunning.mockResolvedValue(true);
    await expect(shouldPauseForegroundWatch('background')).resolves.toBe(true);
  });
});

describe('syncForegroundLocationWatch', () => {
  let stopWatching: jest.Mock;
  let startWatching: jest.Mock;
  let setWatchProfile: jest.Mock;

  beforeEach(() => {
    resetForegroundLocationWatchChainForTests();
    stopWatching = jest.fn();
    startWatching = jest.fn().mockResolvedValue(true);
    setWatchProfile = jest.fn().mockResolvedValue(true);
    isMapScreenFocused.mockReturnValue(false);
    isBackgroundLocationRunning.mockResolvedValue(false);
    useNavigationStore.getState.mockReturnValue({ anchorAlarm: null, mobTarget: null, goToTarget: null });
    usePassageStore.getState.mockReturnValue({ activePassageId: null });
    useLocationStore.getState.mockReturnValue({
      permission: 'foreground',
      watching: false,
      watchProfile: null,
      stopWatching,
      startWatching,
      setWatchProfile,
    });
  });

  it('stops foreground watch when permission is denied', async () => {
    useLocationStore.getState.mockReturnValue({
      permission: 'denied',
      watching: true,
      watchProfile: 'navigation',
      stopWatching,
      startWatching,
      setWatchProfile,
    });

    await expect(syncForegroundLocationWatch()).resolves.toBe(false);
    expect(stopWatching).toHaveBeenCalledWith({ clearFixHistory: true });
    expect(startWatching).not.toHaveBeenCalled();
  });

  it('starts navigation foreground watch for limited anchor watch on non-map tabs', async () => {
    useLocationStore.getState.mockReturnValue({
      permission: 'foreground',
      watching: false,
      watchProfile: null,
      stopWatching,
      startWatching,
      setWatchProfile,
    });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    isBackgroundLocationRunning.mockResolvedValue(false);

    await expect(syncForegroundLocationWatch()).resolves.toBe(true);
    expect(startWatching).toHaveBeenCalledWith({ profile: 'navigation', requestIfUndetermined: false });
  });

  it('starts navigation foreground watch when anchor bg GPS is eligible but not running yet', async () => {
    useLocationStore.getState.mockReturnValue({
      permission: 'background',
      watching: false,
      watchProfile: null,
      stopWatching,
      startWatching,
      setWatchProfile,
    });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    isBackgroundLocationRunning.mockResolvedValue(false);

    await expect(syncForegroundLocationWatch()).resolves.toBe(true);
    expect(startWatching).toHaveBeenCalledWith({ profile: 'navigation', requestIfUndetermined: false });
    expect(stopWatching).not.toHaveBeenCalled();
  });

  it('pauses foreground watch when background GPS is running and idle profile suffices', async () => {
    useLocationStore.getState.mockReturnValue({
      permission: 'background',
      watching: true,
      watchProfile: 'idle',
      stopWatching,
      startWatching,
      setWatchProfile,
    });
    useNavigationStore.getState.mockReturnValue({
      anchorAlarm: { active: true },
      mobTarget: null,
      goToTarget: null,
    });
    isBackgroundLocationRunning.mockResolvedValue(true);

    await expect(syncForegroundLocationWatch()).resolves.toBe(true);
    expect(stopWatching).toHaveBeenCalledWith({ clearFixHistory: false });
  });
});
