/**
 * Atlas POLICY ≥3.5.8/3.5.11 dialog inventory seal for shipping RN Modal
 * ScreenLockOverlay (must_fix: ui-dialog-inventory-incomplete-screen-lock-modal).
 * Proves open → unlock confirm → cancel/dismiss honesty (Android back must not unlock).
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import fs from 'fs';
import path from 'path';

import { ScreenLockOverlay } from '../src/features/map/ScreenLockOverlay';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { useNavigationStore } from '../src/store/navigationStore';

jest.mock('../src/features/map/MobActionButton', () => {
  const ReactLocal = require('react');
  const { Pressable: PressableLocal, Text: TextLocal } = require('react-native');
  return {
    MobActionButton: ({
      onMobDropped,
      testID,
    }: {
      onMobDropped?: () => void;
      testID?: string;
    }) =>
      ReactLocal.createElement(
        PressableLocal,
        {
          testID,
          accessibilityRole: 'button',
          onPress: () => onMobDropped?.(),
        },
        ReactLocal.createElement(TextLocal, null, 'MOB'),
      ),
  };
});
jest.mock('../src/hooks/useMapBottomLayout', () => ({
  useMapBottomLayout: () => ({
    top: 8,
    right: 8,
    actionsColumnBottom: 120,
  }),
}));

jest.mock('../src/hooks/useEffectiveLayoutPreset', () => ({
  useEffectiveLayoutPreset: () => 'full',
  useLayoutContext: () => ({ profileId: 'default', bucket: 'phone', isLandscape: false }),
}));

jest.mock('../src/hooks/useMobLayoutSwitch', () => ({
  useMobLayoutSwitch: () => jest.fn(),
}));

jest.mock('../src/hooks/useSafetyActionsMetrics', () => ({
  useSafetyActionsMetrics: () => ({
    buttonSize: 48,
    borderRadius: 8,
    paddingH: 8,
    paddingV: 8,
    iconSize: 22,
    captionSize: 10,
    gap: 8,
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 360, height: 800, scale: 2, fontScale: 1 }),
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('dlg-map-screen-lock ScreenLockOverlay Modal inventory', () => {
  beforeEach(() => {
    jest.useRealTimers();
    useNavigationStore.setState({ screenLocked: false, anchorAlarm: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    useNavigationStore.setState({ screenLocked: false });
  });

  it('source contracts: Modal + empty onRequestClose + MainShell / MapActions wire', () => {
    const overlaySrc = fs.readFileSync(
      path.join(__dirname, '../src/features/map/ScreenLockOverlay.tsx'),
      'utf8',
    );
    expect(overlaySrc).toContain('<Modal');
    expect(overlaySrc).toContain('testID="map.screenLockOverlay"');
    expect(overlaySrc).toContain('testID="map.mob.locked"');
    expect(overlaySrc).toMatch(/onRequestClose=\{\(\)\s*=>\s*\{/);
    expect(overlaySrc).toContain('Android back must not unlock');

    const shellSrc = fs.readFileSync(path.join(__dirname, '../src/shell/MainShell.tsx'), 'utf8');
    expect(shellSrc).toContain('ScreenLockOverlay');
    expect(shellSrc).toContain('visible={screenLocked}');

    const actionsSrc = fs.readFileSync(
      path.join(__dirname, '../src/features/map/MapActions.tsx'),
      'utf8',
    );
    expect(actionsSrc).toContain('testID="map.screenLock"');
    expect(actionsSrc).toContain('engageScreenLock');
    expect(actionsSrc).toContain('setScreenLocked(true)');
  });

  it('open: engage sets screenLocked; overlay Modal visible with unlock + MOB testIDs', async () => {
    const setLocked = useNavigationStore.getState().setScreenLocked;
    await act(async () => {
      await setLocked(true);
    });
    expect(useNavigationStore.getState().screenLocked).toBe(true);

    const onUnlock = jest.fn();
    const overlay = wrap(<ScreenLockOverlay visible onUnlock={onUnlock} />);
    expect(overlay.getByTestId('map.screenLockOverlay')).toBeTruthy();
    expect(overlay.getByTestId('map.mob.locked')).toBeTruthy();
    const modal = overlay.UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
    overlay.unmount();
  });

  it('confirm: hold unlock (≥1500ms) calls onUnlock', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getByTestId, unmount } = wrap(<ScreenLockOverlay visible onUnlock={onUnlock} />);
    fireEvent(getByTestId('map.screenLockOverlay'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(onUnlock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('cancel: early pressOut aborts unlock; Android back onRequestClose does not unlock', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getByTestId, UNSAFE_getByType, unmount } = wrap(
      <ScreenLockOverlay visible onUnlock={onUnlock} />,
    );

    fireEvent(getByTestId('map.screenLockOverlay'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    fireEvent(getByTestId('map.screenLockOverlay'), 'pressOut');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onUnlock).not.toHaveBeenCalled();

    act(() => {
      UNSAFE_getByType(Modal).props.onRequestClose?.();
    });
    expect(onUnlock).not.toHaveBeenCalled();
    unmount();
  });

  it('confirm via MOB: map.mob.locked drop path unlocks overlay', () => {
    const onUnlock = jest.fn();
    const { getByTestId, unmount } = wrap(<ScreenLockOverlay visible onUnlock={onUnlock} />);
    fireEvent.press(getByTestId('map.mob.locked'));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('hidden: visible=false does not render unlock surface', () => {
    const onUnlock = jest.fn();
    const { queryByTestId, unmount } = wrap(<ScreenLockOverlay visible={false} onUnlock={onUnlock} />);
    expect(queryByTestId('map.screenLockOverlay')).toBeNull();
    unmount();
  });
});
