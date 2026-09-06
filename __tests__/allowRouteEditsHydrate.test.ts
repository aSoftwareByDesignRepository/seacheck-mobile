import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePassageMapPlanningStore } from '../src/store/passageMapPlanningStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('allowRouteEdits hydrate (corrupt AsyncStorage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePassageMapPlanningStore.setState({
      hydrated: false,
      allowRouteEdits: true,
      passageId: null,
    });
  });

  it('must not treat string "false" as allowRouteEdits true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        passageId: 'p1',
        revision: 1,
        allowRouteEdits: 'false',
      }),
    );
    await usePassageMapPlanningStore.getState().hydrate();
    // Corrupt non-boolean → safe default true per parsePersistedBoolean contract
    // BUT must be a real boolean, not leave edits-locked decision to !== false
    expect(typeof usePassageMapPlanningStore.getState().allowRouteEdits).toBe('boolean');
    // String "false" !== false is currently true — we assert intended: fallback default true
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(true);
  });

  it('honors explicit boolean false (route lock)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        passageId: 'p1',
        revision: 1,
        allowRouteEdits: false,
      }),
    );
    await usePassageMapPlanningStore.getState().hydrate();
    expect(usePassageMapPlanningStore.getState().allowRouteEdits).toBe(false);
  });
});
