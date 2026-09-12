/**
 * Atlas POLICY ≥3.5.8 dialog inventory seals for shipping ActionSheet/BottomSheet
 * surfaces missing from earlier ui-matrix.dialogs (must_fix:
 * ui-dialog-inventory-incomplete-actionsheets-bottomsheets).
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';

import { ActionSheet } from '../src/ui/ActionSheet';
import { MapActions } from '../src/features/map/MapActions';
import { CustomDownloadCornerSheet } from '../src/features/downloads/CustomDownloadCornerSheet';
import { PassageWaypointCoordSheet } from '../src/features/passage/PassageWaypointCoordSheet';
import { SeamarkDetailSheet } from '../src/features/map/SeamarkDetailSheet';
import { TrackPointMapDetailSheet } from '../src/features/map/TrackPointMapDetailSheet';
import { WaypointMapDetailSheet } from '../src/features/map/WaypointMapDetailSheet';
import { AnchorWatchLimitedSheet } from '../src/features/map/AnchorWatchLimitedSheet';
import { TabOverflowMenu } from '../src/navigation/TabOverflowMenu';
import { useTabOverflowStore } from '../src/navigation/tabOverflowStore';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { useNavigationStore } from '../src/store/navigationStore';
import type { WaypointRow } from '../src/lib/db/database';
import type { TrackPointRow } from '../src/lib/db/database';
import type { DownloadCorner } from '../src/lib/map/customDownloadCorners';
import type { SeamarkHit } from '../src/lib/seamarks/querySeamark';

jest.mock('../src/ui/BottomSheet', () => {
  const ReactLocal = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    BottomSheet: ({
      visible,
      onClose,
      title,
      subtitle,
      testID,
      children,
      footer,
    }: {
      visible: boolean;
      onClose: () => void;
      title: string;
      subtitle?: string;
      testID?: string;
      children?: React.ReactNode;
      footer?: React.ReactNode;
    }) =>
      visible
        ? ReactLocal.createElement(
            View,
            { testID },
            ReactLocal.createElement(Text, { testID: testID ? `${testID}.title` : undefined }, title),
            subtitle
              ? ReactLocal.createElement(Text, { testID: testID ? `${testID}.subtitle` : undefined }, subtitle)
              : null,
            children,
            footer ?? null,
            ReactLocal.createElement(Pressable, {
              testID: testID ? `${testID}.close` : 'sheet.close',
              accessibilityRole: 'button',
              onPress: onClose,
            }),
          )
        : null,
    SheetDismissFooter: ({ onClose, testID }: { onClose: () => void; testID?: string }) =>
      ReactLocal.createElement(Pressable, {
        testID,
        accessibilityRole: 'button',
        onPress: onClose,
      }),
  };
});

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

const sampleWaypoint: WaypointRow = {
  id: 'wp-1',
  name: 'Buoy A',
  type: 'generic',
  latitude: 54.32,
  longitude: 10.15,
  note: '',
  created_at: 1,
};

const samplePoint: TrackPointRow = {
  id: 1,
  track_id: 'tr-1',
  latitude: 54.3,
  longitude: 10.1,
  recorded_at: Date.now(),
  sog_ms: 2.5,
  cog_deg: 90,
};

const sampleCorner: DownloadCorner = {
  id: 'c1',
  index: 1,
  latitude: 54.3,
  longitude: 10.1,
};

const sampleSeamark: SeamarkHit = {
  name: 'Light',
  type: 'beacon',
  latitude: 54.3,
  longitude: 10.1,
  distanceM: 120,
  source: 'overpass',
  rawTags: {},
};

describe('atlas dialog sheets inventory (ActionSheet/BottomSheet)', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      anchorAlarm: null,
      screenLocked: false,
      anchorWatchPrompt: null,
      anchorWatchPromptDismissed: false,
    });
    useTabOverflowStore.setState({ menuOpen: false, tabBarProps: null });
  });

  it('dlg-map-anchor-clear: open → cancel leaves alarm; confirm clears', async () => {
    const clearSpy = jest.spyOn(useNavigationStore.getState(), 'clearAnchorAlarm');
    useNavigationStore.setState({
      anchorAlarm: {
        active: true,
        latitude: 54.3,
        longitude: 10.1,
        radiusNm: 0.1,
        triggered: false,
        armedLimited: false,
      },
    });

    const { getByTestId, queryByTestId, unmount } = wrap(<MapActions />);
    fireEvent.press(getByTestId('map.anchor'));
    expect(getByTestId('map.anchorClear')).toBeTruthy();

    fireEvent.press(getByTestId('map.anchorClearCancel'));
    await waitFor(() => expect(queryByTestId('map.anchorClear')).toBeNull());
    expect(useNavigationStore.getState().anchorAlarm?.active).toBe(true);

    fireEvent.press(getByTestId('map.anchor'));
    expect(getByTestId('map.anchorClear')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('map.anchorClearConfirm'));
    });
    await waitFor(() => expect(queryByTestId('map.anchorClear')).toBeNull());
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    unmount();
  });

  it('dlg-map-long-press: option path + dismiss; NavigationMap wires testIDs', () => {
    const navSrc = fs.readFileSync(
      path.join(__dirname, '../src/features/map/NavigationMap.tsx'),
      'utf8',
    );
    expect(navSrc).toContain('testID="map.longPress"');
    expect(navSrc).toContain("testID: 'map.longPress.anchor'");
    expect(navSrc).toContain("testID: 'map.longPress.copy'");
    expect(navSrc).toContain("testID: 'map.longPress.seamark'");

    const onClose = jest.fn();
    const onAnchor = jest.fn();
    const { getByTestId, queryByTestId, rerender, unmount } = wrap(
      <ActionSheet
        visible
        onClose={onClose}
        title="Location"
        testID="map.longPress"
        options={[
          { label: 'Anchor', onPress: onAnchor, testID: 'map.longPress.anchor' },
          { label: 'Copy', onPress: () => {}, testID: 'map.longPress.copy' },
        ]}
      />,
    );
    expect(getByTestId('map.longPress')).toBeTruthy();
    fireEvent.press(getByTestId('map.longPress.anchor'));
    expect(onClose).toHaveBeenCalled();
    expect(onAnchor).toHaveBeenCalled();

    rerender(
      <ThemeProvider>
        <ActionSheet
          visible
          onClose={onClose}
          title="Location"
          testID="map.longPress"
          options={[{ label: 'Copy', onPress: () => {}, testID: 'map.longPress.copy' }]}
        />
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('map.longPress.close'));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <ThemeProvider>
        <ActionSheet visible={false} onClose={onClose} title="Location" testID="map.longPress" options={[]} />
      </ThemeProvider>,
    );
    expect(queryByTestId('map.longPress')).toBeNull();
    unmount();
  });

  it('dlg-tab-more-sheet: open → select Downloads → dismiss; Maestro cites tab.more.sheet', () => {
    const dispatch = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const routes = [
      { key: 'map', name: 'Map' },
      { key: 'passage', name: 'Passage' },
      { key: 'tracks', name: 'Tracks' },
      { key: 'downloads', name: 'Downloads' },
      { key: 'settings', name: 'Settings' },
    ];
    const descriptors = Object.fromEntries(
      routes.map((r) => [r.key, { options: { title: r.name }, route: r }]),
    );
    useTabOverflowStore.setState({
      menuOpen: true,
      tabBarProps: {
        state: { key: 'tab', index: 0, routes } as never,
        descriptors: descriptors as never,
        navigation: { navigate: jest.fn(), dispatch, emit } as never,
      },
    });

    const { getByTestId, unmount } = wrap(<TabOverflowMenu />);
    expect(getByTestId('tab.more.sheet')).toBeTruthy();
    fireEvent.press(getByTestId('tab.downloads'));
    expect(dispatch).toHaveBeenCalled();
    expect(useTabOverflowStore.getState().menuOpen).toBe(false);
    unmount();

    act(() => {
      useTabOverflowStore.setState({
        menuOpen: true,
        tabBarProps: {
          state: { key: 'tab', index: 0, routes } as never,
          descriptors: descriptors as never,
          navigation: { navigate: jest.fn(), dispatch, emit } as never,
        },
      });
    });
    const again = wrap(<TabOverflowMenu />);
    fireEvent.press(again.getByTestId('tab.more.sheet.close'));
    expect(useTabOverflowStore.getState().menuOpen).toBe(false);

    const maestro = fs.readFileSync(path.join(__dirname, '../.maestro/01b-open-downloads.yaml'), 'utf8');
    expect(maestro).toContain('tab.more.sheet');
    again.unmount();
  });

  it('dlg-custom-corner-sheet: move/delete/close paths', () => {
    const onClose = jest.fn();
    const onMove = jest.fn();
    const onDelete = jest.fn();
    const { getByTestId, unmount } = wrap(
      <CustomDownloadCornerSheet
        visible
        corner={sampleCorner}
        onClose={onClose}
        onMoveOnMap={onMove}
        onDelete={onDelete}
      />,
    );
    expect(getByTestId('downloads.custom.cornerSheet')).toBeTruthy();
    fireEvent.press(getByTestId('downloads.custom.cornerMove'));
    expect(onMove).toHaveBeenCalledWith('c1');
    fireEvent.press(getByTestId('downloads.custom.cornerDelete'));
    expect(onDelete).toHaveBeenCalledWith('c1');
    fireEvent.press(getByTestId('downloads.custom.cornerClose'));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('dlg-passage-waypoint-coord-sheet: invalid → error; save confirm; cancel dismiss', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn(async () => {});
    const { getByTestId, getByLabelText, findByRole, unmount } = wrap(
      <PassageWaypointCoordSheet visible mode="add" onClose={onClose} onSubmit={onSubmit} />,
    );
    expect(getByTestId('passage.waypointCoordSheet')).toBeTruthy();
    fireEvent.press(getByTestId('passage.waypointCoord.save'));
    expect(await findByRole('alert')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText(/latitude/i), '54.3');
    fireEvent.changeText(getByLabelText(/longitude/i), '10.1');
    await act(async () => {
      fireEvent.press(getByTestId('passage.waypointCoord.save'));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    const cancelRender = wrap(
      <PassageWaypointCoordSheet visible mode="add" onClose={onClose} onSubmit={onSubmit} />,
    );
    fireEvent.press(cancelRender.getByTestId('passage.waypointCoord.cancel'));
    expect(onClose).toHaveBeenCalled();
    cancelRender.unmount();
    unmount();
  });

  it('dlg-track-point-sheet + dlg-seamark-sheet: open + dismiss', () => {
    const onCloseTrack = jest.fn();
    const track = wrap(
      <TrackPointMapDetailSheet point={samplePoint} trackName="Log" onClose={onCloseTrack} />,
    );
    expect(track.getByTestId('trackPoint.sheet')).toBeTruthy();
    fireEvent.press(track.getByTestId('trackPoint.dismiss'));
    expect(onCloseTrack).toHaveBeenCalled();
    track.unmount();

    const onCloseMark = jest.fn();
    const mark = wrap(<SeamarkDetailSheet hit={sampleSeamark} onClose={onCloseMark} />);
    expect(mark.getByTestId('seamark.sheet')).toBeTruthy();
    fireEvent.press(mark.getByTestId('seamark.dismiss'));
    expect(onCloseMark).toHaveBeenCalled();
    mark.unmount();
  });

  it('dlg-waypoint-map-sheet: dismiss + delete-confirm cancel (parent sheet)', () => {
    const onClose = jest.fn();
    const { getByTestId, queryByTestId, unmount } = wrap(
      <WaypointMapDetailSheet waypoint={sampleWaypoint} onClose={onClose} />,
    );
    expect(getByTestId('waypointMap.sheet')).toBeTruthy();
    fireEvent.press(getByTestId('waypointMap.delete'));
    expect(getByTestId('waypointMap.deleteConfirm')).toBeTruthy();
    fireEvent.press(getByTestId('waypointMap.deleteConfirm.cancel'));
    expect(queryByTestId('waypointMap.deleteConfirm')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('waypointMap.dismiss'));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('dlg-anchor-watch-limited-sheet: open + close dismisses prompt', () => {
    useNavigationStore.setState({
      anchorWatchPrompt: {
        limited: true,
        foregroundGranted: true,
        backgroundGranted: false,
        backgroundTaskRunning: false,
        batteryOptimizationRestricted: false,
        notificationsGranted: true,
        reducedAccuracy: false,
      },
    });
    const { getByTestId, unmount } = wrap(<AnchorWatchLimitedSheet />);
    expect(getByTestId('anchorWatch.limited')).toBeTruthy();
    fireEvent.press(getByTestId('anchorWatch.close'));
    expect(useNavigationStore.getState().anchorWatchPrompt).toBeNull();
    unmount();
  });
});
