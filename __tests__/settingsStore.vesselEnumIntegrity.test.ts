import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../src/store/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('settingsStore vessel + enum integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      hydrated: false,
      vessel: { name: '', callSign: '', mmsi: '', homePort: '' },
      sogUnit: 'kn',
    });
  });

  it('strips CRLF from vessel fields on hydrate and updateVessel', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        vessel: { name: 'Sea\nHawk', callSign: 'AB\rCD', mmsi: '123456789', homePort: 'Kiel\tBay' },
      }),
    );
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().vessel.name).toBe('Sea Hawk');
    expect(useSettingsStore.getState().vessel.callSign).toBe('AB CD');
    expect(useSettingsStore.getState().vessel.homePort).toBe('Kiel Bay');

    await useSettingsStore.getState().updateVessel({ name: 'Line1\nLine2' });
    expect(useSettingsStore.getState().vessel.name).toBe('Line1 Line2');
  });

  it('rejects corrupt sogUnit on hydrate', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ sogUnit: 'furlongs' }));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().sogUnit).toBe('kn');
  });

  it('patchSettings rejects corrupt sogUnit (keeps current)', async () => {
    useSettingsStore.setState({ hydrated: true, sogUnit: 'mph' });
    await useSettingsStore.getState().patchSettings({ sogUnit: 'nope' as 'kn' });
    expect(useSettingsStore.getState().sogUnit).toBe('mph');
  });
});
