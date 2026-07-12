import { act, renderHook } from '@testing-library/react-native';

import { usePassageDeactivate } from '../src/hooks/usePassageDeactivate';

const mockDeactivatePassage = jest.fn();
const mockShowInfo = jest.fn();
const mockShowError = jest.fn();

jest.mock('../src/store/passageStore', () => ({
  usePassageStore: Object.assign(
    (selector: (s: { activePassageId: string | null; deactivatePassage: () => Promise<void> }) => unknown) =>
      selector({
        activePassageId: 'pass-1',
        deactivatePassage: mockDeactivatePassage,
      }),
    {
      getState: () => ({ activePassageId: 'pass-1' }),
    },
  ),
}));

jest.mock('../src/store/feedbackStore', () => ({
  useFeedbackStore: (selector: (s: { showInfo: typeof mockShowInfo; showError: typeof mockShowError }) => unknown) =>
    selector({ showInfo: mockShowInfo, showError: mockShowError }),
}));

describe('usePassageDeactivate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeactivatePassage.mockResolvedValue(undefined);
  });

  it('deactivates active passage and shows success toast', async () => {
    const { result } = renderHook(() => usePassageDeactivate());

    let ok = false;
    await act(async () => {
      ok = await result.current.deactivate();
    });

    expect(ok).toBe(true);
    expect(mockDeactivatePassage).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
    expect(result.current.deactivating).toBe(false);
  });

  it('shows error toast when deactivate fails', async () => {
    mockDeactivatePassage.mockRejectedValueOnce(new Error('db'));
    const { result } = renderHook(() => usePassageDeactivate());

    let ok = true;
    await act(async () => {
      ok = await result.current.deactivate();
    });

    expect(ok).toBe(false);
    expect(mockShowError).toHaveBeenCalled();
  });
});
