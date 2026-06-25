import { CommonActions } from '@react-navigation/native';

import { navigateToTab } from '../src/navigation/tabBarHelpers';

describe('navigateToTab', () => {
  it('dispatches navigate with the tab navigator target', () => {
    const dispatch = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigation = { dispatch, emit } as unknown as Parameters<typeof navigateToTab>[2];
    const state = {
      key: 'tab-root',
      index: 0,
      routes: [
        { key: 'map-1', name: 'Map', params: undefined },
        { key: 'downloads-1', name: 'Downloads', params: undefined },
      ],
    } as unknown as Parameters<typeof navigateToTab>[1];

    navigateToTab('Downloads', state, navigation);

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'downloads-1',
      canPreventDefault: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      ...CommonActions.navigate('Downloads', undefined),
      target: 'tab-root',
    });
  });

  it('does not navigate when the tab is already focused', () => {
    const dispatch = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigation = { dispatch, emit } as unknown as Parameters<typeof navigateToTab>[2];
    const state = {
      key: 'tab-root',
      index: 1,
      routes: [
        { key: 'map-1', name: 'Map', params: undefined },
        { key: 'downloads-1', name: 'Downloads', params: undefined },
      ],
    } as unknown as Parameters<typeof navigateToTab>[1];

    navigateToTab('Downloads', state, navigation);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
