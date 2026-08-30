import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('settingsStore hydrate — downloadWifiOnly honesty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      hydrated: false,
      downloadWifiOnly: true,
    });
  });

  it('keeps Wi‑Fi-only ON when storage has numeric 0 (must not bypass policy)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ downloadWifiOnly: 0 }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().downloadWifiOnly).toBe(true);
  });

  it('keeps Wi‑Fi-only ON when storage has string "false"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ downloadWifiOnly: 'false' }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().downloadWifiOnly).toBe(true);
  });

  it('restores explicit false boolean (user disabled Wi‑Fi-only)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ downloadWifiOnly: false }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().downloadWifiOnly).toBe(false);
  });
});
