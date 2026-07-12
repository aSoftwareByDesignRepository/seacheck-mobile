import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('settingsStore hydrate — instrument readouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      hydrated: false,
      mapShowXte: true,
      mapShowLeeway: true,
    });
  });

  it('restores mapShowLeeway false from storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ mapShowLeeway: false, mapShowXte: true }),
    );
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapShowLeeway).toBe(false);
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });

  it('defaults mapShowLeeway when key is missing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapShowLeeway).toBe(false);
  });

  it('rejects corrupted boolean strings for mapShowLeeway', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ mapShowLeeway: 'false' }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().mapShowLeeway).toBe(false);
  });
});
