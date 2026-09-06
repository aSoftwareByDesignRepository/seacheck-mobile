import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('settingsStore hydrate — safety-relevant booleans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      hydrated: false,
      alarmSoundEnabled: true,
      alarmHapticEnabled: true,
      onboardingCompleted: false,
      downloadWifiOnly: true,
    });
  });

  it('keeps alarm sound ON when storage has numeric 0 (must not silence alarms)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ alarmSoundEnabled: 0 }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().alarmSoundEnabled).toBe(true);
  });

  it('keeps alarm haptic ON when storage has string "false"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ alarmHapticEnabled: 'false' }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().alarmHapticEnabled).toBe(true);
  });

  it('does not skip onboarding when storage has string "false"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ onboardingCompleted: 'false' }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
  });

  it('restores explicit boolean false for alarms and onboarding', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        alarmSoundEnabled: false,
        alarmHapticEnabled: false,
        onboardingCompleted: true,
      }),
    );
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().alarmSoundEnabled).toBe(false);
    expect(useSettingsStore.getState().alarmHapticEnabled).toBe(false);
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
  });

  it('rejects corrupt followMode string — never leaves a truthy non-boolean in state', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: 'false' }));
    await useSettingsStore.getState().hydrate();
    expect(typeof useSettingsStore.getState().followMode).toBe('boolean');
    expect(useSettingsStore.getState().followMode).toBe(true);
  });

  it('patchSettings rejects non-boolean alarmSoundEnabled (cannot silence via garbage)', async () => {
    useSettingsStore.setState({ hydrated: true, alarmSoundEnabled: true });
    await useSettingsStore.getState().patchSettings({
      alarmSoundEnabled: 'false' as unknown as boolean,
    });
    expect(useSettingsStore.getState().alarmSoundEnabled).toBe(true);
    expect(typeof useSettingsStore.getState().alarmSoundEnabled).toBe('boolean');
  });
});
