import type { FormFactor } from '../../hooks/useFormFactor';

/** Matches AdaptiveTabBar compact bottom bar (padding + row + safe area). */
export const TAB_BAR_TOP_PADDING = 6;
export const TAB_BAR_BOTTOM_PADDING_MIN = 8;

export function usesBottomTabBar(_formFactor: FormFactor, _isLandscape: boolean): boolean {
  return true;
}

export function tabBarOccupiedHeight(safeAreaBottom: number, minTouch: number): number {
  return TAB_BAR_TOP_PADDING + minTouch + Math.max(safeAreaBottom, TAB_BAR_BOTTOM_PADDING_MIN);
}
