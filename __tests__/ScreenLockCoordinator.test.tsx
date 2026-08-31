import React from 'react';
import { act, render } from '@testing-library/react-native';

import { ScreenLockCoordinator } from '../src/features/map/ScreenLockCoordinator';
import { requestConfirm, resetConfirmStoreForTests, useConfirmStore } from '../src/store/confirmStore';
import { useNavigationStore } from '../src/store/navigationStore';

const mockDismissAll = jest.fn();
const mockSetMenuOpen = jest.fn();
const mockClearFeedback = jest.fn();

jest.mock('../src/ui/sheetHost', () => ({
  useSheetHost: () => ({ dismissAll: mockDismissAll }),
}));

jest.mock('../src/navigation/tabOverflowStore', () => ({
  useTabOverflowStore: (sel: (s: { setMenuOpen: typeof mockSetMenuOpen }) => unknown) =>
    sel({ setMenuOpen: mockSetMenuOpen }),
}));

jest.mock('../src/store/feedbackStore', () => ({
  useFeedbackStore: (sel: (s: { clear: typeof mockClearFeedback }) => unknown) =>
    sel({ clear: mockClearFeedback }),
}));

describe('ScreenLockCoordinator', () => {
  beforeEach(() => {
    mockDismissAll.mockClear();
    mockSetMenuOpen.mockClear();
    mockClearFeedback.mockClear();
    resetConfirmStoreForTests();
    useNavigationStore.setState({ screenLocked: false });
  });

  afterEach(async () => {
    await act(async () => {
      resetConfirmStoreForTests();
      useNavigationStore.setState({ screenLocked: false });
    });
  });

  it('drains queued confirms before dismissAll so lock cannot resurface a dialog', async () => {
    const first = requestConfirm({ title: 'A', message: 'a', confirmLabel: 'OK' });
    const second = requestConfirm({ title: 'B', message: 'b', confirmLabel: 'OK' });
    expect(useConfirmStore.getState().visible).toBe(true);

    render(<ScreenLockCoordinator />);

    await act(async () => {
      useNavigationStore.setState({ screenLocked: true });
    });

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(useConfirmStore.getState().visible).toBe(false);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockClearFeedback).toHaveBeenCalledTimes(1);
  });

  it('is idempotent while locked (no double dismiss on re-render)', async () => {
    render(<ScreenLockCoordinator />);
    await act(async () => {
      useNavigationStore.setState({ screenLocked: true });
    });
    await act(async () => {
      useNavigationStore.setState({ screenLocked: true });
    });
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
  });
});
