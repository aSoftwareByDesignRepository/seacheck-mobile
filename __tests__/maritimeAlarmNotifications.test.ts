jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(() => {
    throw new TypeError("Cannot read property 'reload' of undefined");
  }),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

describe('maritimeAlarmNotifications', () => {
  beforeEach(() => {
    jest.resetModules();
    const mod = require('../src/services/maritimeAlarmNotifications');
    mod.resetMaritimeAlarmNotificationsForTests();
  });

  it('initMaritimeAlarmNotifications survives broken native module', async () => {
    const { initMaritimeAlarmNotifications, getMaritimeNotificationPermission } =
      require('../src/services/maritimeAlarmNotifications') as typeof import('../src/services/maritimeAlarmNotifications');
    await expect(initMaritimeAlarmNotifications()).resolves.toBeUndefined();
    expect(getMaritimeNotificationPermission()).toBe('denied');
  });
});
