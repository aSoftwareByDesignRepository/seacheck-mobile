import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootTabParamList } from './types';

/** Root tab navigator — Map must host the download GL surface. */
export const rootNavigationRef = createNavigationContainerRef<RootTabParamList>();

/** Send the user to Map so the sticky visible sweep map can mount and paint tiles. */
export function navigateToMapForChartDownload(): void {
  if (!rootNavigationRef.isReady()) return;
  // Prefer jumpTo when available — forces tab focus without stacking.
  const nav = rootNavigationRef as typeof rootNavigationRef & {
    jumpTo?: (name: keyof RootTabParamList) => void;
  };
  if (typeof nav.jumpTo === 'function') {
    try {
      nav.jumpTo('Map');
      return;
    } catch {
      /* fall through to navigate */
    }
  }
  nav.navigate('Map');
}
