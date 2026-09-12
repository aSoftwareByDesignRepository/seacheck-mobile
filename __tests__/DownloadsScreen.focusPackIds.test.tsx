/**
 * Atlas filter proof: flt-downloads-focus-pack-ids
 * Route param focusPackIds toggles recommended strip vs full P0/P1/P2 catalog.
 */
import React from 'react';
import { fireEvent, within } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';

import { DownloadsScreen } from '../src/screens/DownloadsScreen';
import { REGION_PACKS } from '../src/map/regionPacks';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { resetOfflinePackStoreForTests, useOfflinePackStore } from '../src/store/offlinePackStore';

const FOCUS_PACK_ID = 'kiel-bay';

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

function renderDownloads(params: Partial<typeof mockRouteParams> = {}) {
  Object.keys(mockRouteParams).forEach((k) => {
    delete (mockRouteParams as Record<string, unknown>)[k];
  });
  Object.assign(mockRouteParams, params);
  return render(
    <ThemeProvider>
      <DownloadsScreen />
    </ThemeProvider>,
  );
}

describe('DownloadsScreen focusPackIds filter (flt-downloads-focus-pack-ids)', () => {
  beforeEach(() => {
    mockSetParams.mockClear();
    Object.keys(mockRouteParams).forEach((k) => {
      delete (mockRouteParams as Record<string, unknown>)[k];
    });
    resetOfflinePackStoreForTests();
    useOfflinePackStore.setState({
      hydrated: true,
      chartStyleUri: 'file:///mock/style.json',
    });
  });

  afterEach(() => {
    resetOfflinePackStoreForTests();
  });

  it('with focusPackIds=[kiel-bay] shows recommended strip and excludes pack from P0 remainder', () => {
    const { getByTestId, unmount } = renderDownloads({ focusPackIds: [FOCUS_PACK_ID] });

    const recommended = getByTestId('downloads.passageRecommended');
    expect(within(recommended).getByTestId(`downloads.pack.${FOCUS_PACK_ID}`)).toBeTruthy();

    const p0 = getByTestId('downloads.regionPacksP0');
    expect(within(p0).queryByTestId(`downloads.pack.${FOCUS_PACK_ID}`)).toBeNull();

    const p0Expected = REGION_PACKS.filter((p) => p.priority === 'P0' && p.id !== FOCUS_PACK_ID);
    for (const pack of p0Expected) {
      expect(within(p0).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }

    fireEvent.press(getByTestId('downloads.regionPacksP1.toggle'));
    fireEvent.press(getByTestId('downloads.regionPacksP2.toggle'));
    expect(within(getByTestId('downloads.regionPacksP1')).queryByTestId(`downloads.pack.${FOCUS_PACK_ID}`)).toBeNull();
    expect(within(getByTestId('downloads.regionPacksP2')).queryByTestId(`downloads.pack.${FOCUS_PACK_ID}`)).toBeNull();
    unmount();
  });

  it('with empty focusPackIds shows full catalog and no recommended strip', () => {
    const { getByTestId, queryByTestId, unmount } = renderDownloads({ focusPackIds: [] });

    expect(queryByTestId('downloads.passageRecommended')).toBeNull();

    const p0 = getByTestId('downloads.regionPacksP0');
    const p0Packs = REGION_PACKS.filter((p) => p.priority === 'P0');
    expect(p0Packs.length).toBeGreaterThan(0);
    for (const pack of p0Packs) {
      expect(within(p0).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }

    fireEvent.press(getByTestId('downloads.regionPacksP1.toggle'));
    const p1 = getByTestId('downloads.regionPacksP1');
    for (const pack of REGION_PACKS.filter((p) => p.priority === 'P1')) {
      expect(within(p1).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }

    fireEvent.press(getByTestId('downloads.regionPacksP2.toggle'));
    const p2 = getByTestId('downloads.regionPacksP2');
    for (const pack of REGION_PACKS.filter((p) => p.priority === 'P2')) {
      expect(within(p2).getByTestId(`downloads.pack.${pack.id}`)).toBeTruthy();
    }
    unmount();
  });

  it('omitting focusPackIds matches empty-focus full catalog', () => {
    const { queryByTestId, getByTestId, unmount } = renderDownloads({});
    expect(queryByTestId('downloads.passageRecommended')).toBeNull();
    expect(within(getByTestId('downloads.regionPacksP0')).getByTestId(`downloads.pack.${FOCUS_PACK_ID}`)).toBeTruthy();
    unmount();
  });
});
