jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isPassageMonitoringNeeded } from '../src/lib/alarms/alarmCoordinator';

describe('isPassageMonitoringNeeded', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns false when no active passage', async () => {
    await expect(isPassageMonitoringNeeded()).resolves.toBe(false);
  });
});
