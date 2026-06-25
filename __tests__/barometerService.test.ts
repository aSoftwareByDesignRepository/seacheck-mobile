jest.mock('expo-sensors', () => ({
  Barometer: {
    isAvailableAsync: jest.fn().mockRejectedValue(new TypeError("Cannot read property 'reload' of undefined")),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(),
  },
}));

describe('barometerService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('hydrateBarometer completes when expo-sensors throws', async () => {
    const { hydrateBarometer, getBarometerState } = require('../src/services/barometerService') as typeof import('../src/services/barometerService');
    await expect(hydrateBarometer()).resolves.toBeUndefined();
    const snapshot = getBarometerState();
    expect(snapshot.hydrated).toBe(true);
    expect(snapshot.available).toBe(false);
  });
});
