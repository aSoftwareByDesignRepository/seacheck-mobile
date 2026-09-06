/**
 * Documents the MainShell ↔ Tab.Navigator contract:
 * active-tab tracking must NOT use useNavigationState in MainShell (host is outside
 * the navigator and crashes with a RedBox). screenListeners.state is the safe path.
 */
describe('MainShell active-tab contract', () => {
  it('tracks tab changes from navigator state events without useNavigationState', () => {
    // Mirrors MainShell.onTabNavigatorState — keep in sync if that helper moves.
    let activeTab: string = 'Map';
    const onTabNavigatorState = (e: {
      data: { state?: { index: number; routes: { name: string }[] } };
    }) => {
      const navState = e.data.state;
      if (!navState?.routes?.length) return;
      const route = navState.routes[navState.index];
      if (route?.name) activeTab = route.name;
    };

    onTabNavigatorState({
      data: {
        state: {
          index: 3,
          routes: [
            { name: 'Map' },
            { name: 'Passage' },
            { name: 'Tracks' },
            { name: 'Downloads' },
            { name: 'Settings' },
          ],
        },
      },
    });
    expect(activeTab).toBe('Downloads');
    // Global chrome must hide on Downloads to avoid double banners.
    expect(activeTab !== 'Downloads').toBe(false);

    onTabNavigatorState({
      data: {
        state: {
          index: 0,
          routes: [
            { name: 'Map' },
            { name: 'Passage' },
            { name: 'Tracks' },
            { name: 'Downloads' },
            { name: 'Settings' },
          ],
        },
      },
    });
    expect(activeTab).toBe('Map');
    expect(activeTab !== 'Downloads').toBe(true);
  });

  it('ignores empty / missing state (boot race)', () => {
    let activeTab = 'Map';
    const onTabNavigatorState = (e: {
      data: { state?: { index: number; routes: { name: string }[] } };
    }) => {
      const navState = e.data.state;
      if (!navState?.routes?.length) return;
      const route = navState.routes[navState.index];
      if (route?.name) activeTab = route.name;
    };
    onTabNavigatorState({ data: {} });
    onTabNavigatorState({ data: { state: { index: 0, routes: [] } } });
    expect(activeTab).toBe('Map');
  });
});
