import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAnchorWatchLimitedChrome } from '../src/lib/anchor/anchorLimitedChrome';
import {
  activateAnchorAlarmAt,
  refreshAnchorWatchPromptIfNeeded,
} from '../src/lib/anchor/activateAnchorAlarm';
import { useNavigationStore } from '../src/store/navigationStore';
import { requestConfirm, resetConfirmStoreForTests } from '../src/store/confirmStore';
import { useLocationStore } from '../src/services/locationService';
import { getMaritimeNotificationPermission } from '../src/services/maritimeAlarmNotifications';
import { getBatteryOptimizationStatus } from '../src/lib/permissions/batteryOptimization';
import { isBackgroundLocationRunning } from '../src/services/backgroundLocationService';

jest.mock('../src/store/confirmStore', () => {
  const actual = jest.requireActual('../src/store/confirmStore');
  return {
    ...actual,
    requestConfirm: jest.fn(),
  };
});

jest.mock('../src/services/locationService', () => ({
  useLocationStore: {
    getState: jest.fn(() => ({
      permission: 'foreground',
      reducedAccuracy: false,
      refreshPermission: jest.fn(async () => undefined),
    })),
  },
}));

jest.mock('../src/services/maritimeAlarmNotifications', () => ({
  ensureMaritimeAlarmNotifications: jest.fn(async () => true),
  getMaritimeNotificationPermission: jest.fn(() => 'denied'),
  refreshMaritimeNotificationPermission: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/permissions/batteryOptimization', () => ({
  getBatteryOptimizationStatus: jest.fn(async () => 'restricted'),
}));

jest.mock('../src/services/backgroundLocationService', () => ({
  isBackgroundLocationRunning: jest.fn(async () => false),
  syncBackgroundLocationMonitoring: jest.fn(async () => ({ ok: false, reason: 'no_permission' })),
}));

jest.mock('../src/store/feedbackStore', () => ({
  useFeedbackStore: {
    getState: () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn(),
    }),
  },
}));

const mockedRequestConfirm = requestConfirm as jest.MockedFunction<typeof requestConfirm>;

function mockLimitedWatch() {
  (useLocationStore.getState as jest.Mock).mockReturnValue({
    permission: 'foreground',
    reducedAccuracy: false,
    refreshPermission: jest.fn(async () => undefined),
  });
  (getMaritimeNotificationPermission as jest.Mock).mockReturnValue('denied');
  (getBatteryOptimizationStatus as jest.Mock).mockResolvedValue('restricted');
  (isBackgroundLocationRunning as jest.Mock).mockResolvedValue(false);
}

function mockFullWatch() {
  (useLocationStore.getState as jest.Mock).mockReturnValue({
    permission: 'background',
    reducedAccuracy: false,
    refreshPermission: jest.fn(async () => undefined),
  });
  (getMaritimeNotificationPermission as jest.Mock).mockReturnValue('granted');
  (getBatteryOptimizationStatus as jest.Mock).mockResolvedValue('exempt');
  (isBackgroundLocationRunning as jest.Mock).mockResolvedValue(true);
}

describe('limited anchor watch durability', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetConfirmStoreForTests();
    mockedRequestConfirm.mockReset();
    mockedRequestConfirm.mockResolvedValue(true);
    mockLimitedWatch();
    useNavigationStore.setState({
      hydrated: true,
      goToTarget: null,
      mobTarget: null,
      mobDroppedAtMs: null,
      anchorAlarm: null,
      activeLegIndex: 0,
      sessionDistanceNm: 0,
      sessionStartedAtMs: null,
      alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
      screenLocked: false,
      mobLayoutRestoreContextKey: null,
      anchorWatchPrompt: null,
      anchorWatchPromptDismissed: false,
    });
  });

  it('isAnchorWatchLimitedChrome respects persisted armedLimited before live poll', () => {
    expect(isAnchorWatchLimitedChrome(null)).toBe(false);
    expect(
      isAnchorWatchLimitedChrome({
        active: true,
        armedLimited: true,
      }),
    ).toBe(true);
    expect(
      isAnchorWatchLimitedChrome(
        {
          active: true,
          armedLimited: false,
        },
        true,
      ),
    ).toBe(true);
    expect(
      isAnchorWatchLimitedChrome({
        active: true,
        armedLimited: false,
      }),
    ).toBe(false);
  });

  it('activate persists armedLimited and survives hydrate', async () => {
    const status = await activateAnchorAlarmAt(54.1, 10.2, 0.05);
    expect(status?.limited).toBe(true);
    expect(mockedRequestConfirm).toHaveBeenCalled();

    const armed = useNavigationStore.getState().anchorAlarm;
    expect(armed?.active).toBe(true);
    expect(armed?.armedLimited).toBe(true);
    expect(isAnchorWatchLimitedChrome(armed)).toBe(true);

    const raw = await AsyncStorage.getItem('seacheck.navigation.v1');
    expect(raw).toContain('"armedLimited":true');

    useNavigationStore.setState({
      anchorAlarm: null,
      hydrated: false,
      anchorWatchPrompt: null,
      anchorWatchPromptDismissed: true,
    });
    await useNavigationStore.getState().hydrate();

    const after = useNavigationStore.getState().anchorAlarm;
    expect(after?.armedLimited).toBe(true);
    expect(isAnchorWatchLimitedChrome(after)).toBe(true);
    expect(useNavigationStore.getState().anchorWatchPromptDismissed).toBe(false);
  });

  it('refresh clears armedLimited when watch becomes full', async () => {
    await useNavigationStore.getState().setAnchorAlarm(54, 10, 0.05, { armedLimited: true });
    expect(useNavigationStore.getState().anchorAlarm?.armedLimited).toBe(true);

    mockFullWatch();

    const status = await refreshAnchorWatchPromptIfNeeded();
    expect(status?.limited).toBe(false);
    expect(useNavigationStore.getState().anchorAlarm?.armedLimited).toBe(false);
    expect(isAnchorWatchLimitedChrome(useNavigationStore.getState().anchorAlarm)).toBe(false);
  });

  it('does not arm when user cancels limited confirm', async () => {
    mockedRequestConfirm.mockResolvedValue(false);
    const status = await activateAnchorAlarmAt(54.1, 10.2, 0.05);
    expect(status).toBeNull();
    expect(useNavigationStore.getState().anchorAlarm).toBeNull();
  });
});
