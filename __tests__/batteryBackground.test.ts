jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: { openSettings: jest.fn() },
}));

jest.mock('expo-application', () => ({
  applicationId: 'de.softwarebydesign.seacheck',
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
  ActivityAction: {
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  },
}));

const mockIsBatteryOptimizationEnabledAsync = jest.fn();

jest.mock('expo-battery', () => ({
  __esModule: true,
  isBatteryOptimizationEnabledAsync: (...args: unknown[]) => mockIsBatteryOptimizationEnabledAsync(...args),
}));

describe('batteryOptimization', () => {
  beforeEach(() => {
    jest.resetModules();
    mockIsBatteryOptimizationEnabledAsync.mockReset();
  });

  it('maps enabled optimization to restricted on Android', async () => {
    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(true);
    const { getBatteryOptimizationStatus } = require('../src/lib/permissions/batteryOptimization') as typeof import('../src/lib/permissions/batteryOptimization');
    await expect(getBatteryOptimizationStatus()).resolves.toBe('restricted');
  });

  it('maps disabled optimization to exempt on Android', async () => {
    mockIsBatteryOptimizationEnabledAsync.mockResolvedValue(false);
    const { getBatteryOptimizationStatus } = require('../src/lib/permissions/batteryOptimization') as typeof import('../src/lib/permissions/batteryOptimization');
    await expect(getBatteryOptimizationStatus()).resolves.toBe('exempt');
  });

  it('returns unknown when battery API fails', async () => {
    mockIsBatteryOptimizationEnabledAsync.mockRejectedValue(new Error('unsupported'));
    const { getBatteryOptimizationStatus } = require('../src/lib/permissions/batteryOptimization') as typeof import('../src/lib/permissions/batteryOptimization');
    await expect(getBatteryOptimizationStatus()).resolves.toBe('unknown');
  });

  it('opens direct exemption intent with package URI', async () => {
    const IntentLauncher = require('expo-intent-launcher');
    const { requestBatteryOptimizationExemption } = require('../src/lib/permissions/batteryOptimization') as typeof import('../src/lib/permissions/batteryOptimization');
    await requestBatteryOptimizationExemption();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:de.softwarebydesign.seacheck' },
    );
  });
});