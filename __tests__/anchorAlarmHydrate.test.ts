import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigationStore } from '../src/store/navigationStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('anchorAlarm hydrate (corrupt AsyncStorage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNavigationStore.setState({
      hydrated: false,
      anchorAlarm: null,
    });
  });

  it('must not revive an anchor alarm when active is string "false"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        anchorAlarm: {
          active: 'false',
          latitude: 54.5,
          longitude: 10.1,
          radiusNm: 0.05,
          triggered: false,
          armedLimited: false,
        },
      }),
    );
    await useNavigationStore.getState().hydrate();
    expect(useNavigationStore.getState().anchorAlarm).toBeNull();
  });

  it('must not treat triggered string "false" as true (false alarm)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        anchorAlarm: {
          active: true,
          latitude: 54.5,
          longitude: 10.1,
          radiusNm: 0.05,
          triggered: 'false',
          armedLimited: false,
        },
      }),
    );
    await useNavigationStore.getState().hydrate();
    const alarm = useNavigationStore.getState().anchorAlarm;
    expect(alarm).not.toBeNull();
    expect(alarm!.triggered).toBe(false);
    expect(typeof alarm!.triggered).toBe('boolean');
  });
});
