import type { EdgeInsets } from 'react-native-safe-area-context';

/** Minimum screen-edge padding for map chrome (WCAG touch + thumb reach). */
export const MAP_EDGE_MIN = 16;

export type MapChromeInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Safe-area-aware horizontal/vertical padding for map overlays and FABs. */
export function mapChromeInsets(insets: EdgeInsets, spacingMd = 12): MapChromeInsets {
  const pad = Math.max(MAP_EDGE_MIN, spacingMd);
  return {
    left: insets.left + pad,
    right: insets.right + pad,
    top: insets.top + pad,
    bottom: insets.bottom + pad,
  };
}
