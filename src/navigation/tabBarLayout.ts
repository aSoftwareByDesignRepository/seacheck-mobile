import type { RootTabParamList } from './types';

export type TabName = keyof RootTabParamList;

/** Primary destinations — always visible when the overflow menu is shown. */
export const PRIMARY_BOTTOM_TABS: TabName[] = ['Map', 'Passage', 'Waypoints', 'Tracks'];

/** Secondary destinations — shown inside the “More” menu on compact widths. */
export const OVERFLOW_BOTTOM_TABS: TabName[] = ['Downloads', 'Settings'];

export const ALL_BOTTOM_TABS: TabName[] = [...PRIMARY_BOTTOM_TABS, ...OVERFLOW_BOTTOM_TABS];

/** Minimum width (px) to show all six tabs with labels without clipping. */
export const FULL_TAB_BAR_WIDTH = 480;

/** Side navigation rail width — keep in sync with AdaptiveTabBar rail styles. */
export const RAIL_WIDTH = 88;

export function resolveBottomTabLayout(width: number): { visible: TabName[]; overflow: TabName[] } {
  if (width >= FULL_TAB_BAR_WIDTH) {
    return { visible: ALL_BOTTOM_TABS, overflow: [] };
  }
  return { visible: PRIMARY_BOTTOM_TABS, overflow: OVERFLOW_BOTTOM_TABS };
}
