import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('followMode hydrate (corrupt AsyncStorage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ hydrated: false, followMode: true });
  });

  it('rejects string "false" — must restore boolean default, never leave a truthy string', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: 'false' }));
    await useSettingsStore.getState().hydrate();
    // Default cruise followMode is true; corrupt non-boolean falls back (fail-safe).
    expect(useSettingsStore.getState().followMode).toBe(true);
    expect(typeof useSettingsStore.getState().followMode).toBe('boolean');
  });

  it('rejects numeric 1 — must not coerce into the settings state as a number', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: 1 }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().followMode).toBe(true);
    expect(typeof useSettingsStore.getState().followMode).toBe('boolean');
  });

  it('honors explicit boolean false (user turned follow off)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: false }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().followMode).toBe(false);
  });
});
