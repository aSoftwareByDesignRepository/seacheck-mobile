jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/db/database', () => ({
  getDatabase: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { NAV_STORAGE_KEY } from '../src/lib/alarms/alarmCoordinator';
import {
  isGoToMonitoringNeeded,
  isMobMonitoringNeeded,
  isPassageMonitoringNeeded,
  normalizeNavPersist,
} from '../src/lib/alarms/alarmCoordinator';

const { getDatabase } = require('../src/lib/db/database') as {
  getDatabase: jest.Mock;
};

const GO_TO = {
  id: 'wp-1',
  name: 'Mark',
  latitude: 54.1,
  longitude: 10.2,
  kind: 'waypoint' as const,
};

const MOB = {
  id: 'mob-1',
  name: 'MOB',
  latitude: 54.1,
  longitude: 10.2,
  kind: 'mob' as const,
};

describe('normalizeNavPersist', () => {
  it('infers mobTarget from legacy goToTarget.kind === mob payloads', () => {
    const normalized = normalizeNavPersist({
      goToTarget: MOB,
      mobTarget: null,
      anchorAlarm: null,
      activeLegIndex: 0,
    });
    expect(normalized.mobTarget).toEqual(MOB);
  });
});

describe('isPassageMonitoringNeeded', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    getDatabase.mockReset();
  });

  it('returns false when no active passage', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });
    await expect(isPassageMonitoringNeeded()).resolves.toBe(false);
  });

  it('returns false when active passage has no go-to target', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue({ id: 'pass-1' }),
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'wp-a', name: 'A', latitude: 54, longitude: 10 },
        { id: 'wp-b', name: 'B', latitude: 54.1, longitude: 10.1 },
      ]),
    });
    await expect(isPassageMonitoringNeeded()).resolves.toBe(false);
  });

  it('returns true when active passage has go-to and at least two waypoints', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue({ id: 'pass-1', default_sog_kn: 5, planned_departure: null }),
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'wp-a', name: 'A', latitude: 54, longitude: 10 },
        { id: 'wp-b', name: 'B', latitude: 54.1, longitude: 10.1 },
      ]),
    });
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ goToTarget: GO_TO, mobTarget: null, anchorAlarm: null, activeLegIndex: 0 }),
    );
    await expect(isPassageMonitoringNeeded()).resolves.toBe(true);
  });
});

describe('isMobMonitoringNeeded', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    getDatabase.mockReset();
  });

  it('returns true for legacy MOB payloads without mobTarget field', async () => {
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ goToTarget: MOB, anchorAlarm: null, activeLegIndex: 0 }),
    );
    await expect(isMobMonitoringNeeded()).resolves.toBe(true);
  });

  it('returns false when no MOB target is active', async () => {
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ goToTarget: GO_TO, mobTarget: null, anchorAlarm: null, activeLegIndex: 0 }),
    );
    await expect(isMobMonitoringNeeded()).resolves.toBe(false);
  });
});

describe('isGoToMonitoringNeeded', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    getDatabase.mockReset();
  });

  it('returns false when no go-to target', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });
    await expect(isGoToMonitoringNeeded()).resolves.toBe(false);
  });

  it('returns false when go-to is MOB', async () => {
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({
        goToTarget: MOB,
        mobTarget: MOB,
        anchorAlarm: null,
        activeLegIndex: 0,
      }),
    );
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });
    await expect(isGoToMonitoringNeeded()).resolves.toBe(false);
  });

  it('returns false when active passage covers go-to monitoring', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue({ id: 'pass-1' }),
    });
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ goToTarget: GO_TO, mobTarget: null, anchorAlarm: null, activeLegIndex: 0 }),
    );
    await expect(isGoToMonitoringNeeded()).resolves.toBe(false);
  });

  it('returns true for standalone waypoint go-to without active passage', async () => {
    getDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });
    await AsyncStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ goToTarget: GO_TO, mobTarget: null, anchorAlarm: null, activeLegIndex: 0 }),
    );
    await expect(isGoToMonitoringNeeded()).resolves.toBe(true);
  });
});
