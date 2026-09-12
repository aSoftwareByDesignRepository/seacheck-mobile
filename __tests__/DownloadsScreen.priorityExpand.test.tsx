/**
 * Atlas list_option proof: opt-downloads-priority-sections
 * P1/P2 CollapsibleDownloadsSection expand toggles are user-selectable.
 */
import React from 'react';
import { fireEvent, within } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';

import { DownloadsScreen } from '../src/screens/DownloadsScreen';
import { REGION_PACKS } from '../src/map/regionPacks';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';

const mockRouteParams: {
  focusPackIds?: string[];
  scrollToCustom?: boolean;
  passageBounds?: unknown;
  passageName?: string;
} = {};

const mockSetParams = jest.fn();
const mockNavigation = {
  setParams: mockSetParams,
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNavigation,
    useRoute: () => ({
      key: 'Downloads',
      name: 'Downloads',
      params: mockRouteParams,
    }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactLocal.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [cb]);
    },
  };
});

jest.mock('@react-navigation/elements', () => {
  const actual = jest.requireActual('@react-navigation/elements');
  return {
    ...actual,
    useHeaderHeight: () => 0,
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

jest.mock('../src/features/downloads/RegionPackMapPreview', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    RegionPackMapPreview: () => ReactLocal.createElement(View, { testID: 'downloads.packPreview.mock' }),
  };
});

jest.mock('../src/features/downloads/CustomDownloadSection', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    CustomDownloadSection: () => ReactLocal.createElement(View, { testID: 'downloads.customSection.mock' }),
  };
});

function renderDownloads() {
  Object.keys(mockRouteParams).forEach((k) => {
    delete (mockRouteParams as Record<string, unknown>)[k];
  });
  return render(
    <ThemeProvider>
      <DownloadsScreen />
    </ThemeProvider>,
  );
}

describe('DownloadsScreen P1/P2 priority expand toggles (opt-downloads-priority-sections)', () => {
  beforeEach(() => {
    mockSetParams.mockClear();
    resetOfflinePackStoreForTests();
    useOfflinePackStore.setState({
      hydrated: true,
      chartStyleUri: 'file:///mock/style.json',
    });
  });

  afterEach(() => {
    resetOfflinePackStoreForTests();
  });

  it('P1 and P2 start collapsed; toggle expands packs then collapses again', () => {
    const p1Packs = REGION_PACKS.filter((p) => p.priority === 'P1');
    const p2Packs = REGION_PACKS.filter((p) => p.priority === 'P2');
    expect(p1Packs.length).toBeGreaterThan(0);
    expect(p2Packs.length).toBeGreaterThan(0);

    const { getByTestId, unmount } = renderDownloads();

    const p1 = getByTestId('downloads.regionPacksP1');
    const p2 = getByTestId('downloads.regionPacksP2');
    expect(within(p1).queryByTestId(`downloads.pack.${p1Packs[0].id}`)).toBeNull();
    expect(within(p2).queryByTestId(`downloads.pack.${p2Packs[0].id}`)).toBeNull();

    fireEvent.press(getByTestId('downloads.regionPacksP1.toggle'));
    for (const pack of p1Packs) {
      expect(within(getByTestId('downloads.regionPacksP1')).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }
    fireEvent.press(getByTestId('downloads.regionPacksP1.toggle'));
    expect(within(getByTestId('downloads.regionPacksP1')).queryByTestId(`downloads.pack.${p1Packs[0].id}`)).toBeNull();

    fireEvent.press(getByTestId('downloads.regionPacksP2.toggle'));
    for (const pack of p2Packs) {
      expect(within(getByTestId('downloads.regionPacksP2')).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }
    fireEvent.press(getByTestId('downloads.regionPacksP2.toggle'));
    expect(within(getByTestId('downloads.regionPacksP2')).queryByTestId(`downloads.pack.${p2Packs[0].id}`)).toBeNull();

    unmount();
  });
});
