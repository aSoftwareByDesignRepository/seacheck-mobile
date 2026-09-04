import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { ensureMapLibreNetworkForDownload } from '../lib/network/mapLibreNetworkGate';
import { setMapScreenFocused } from '../lib/map/mapScreenFocus';
import { releaseOfflineMapEngineViewportForNavigation } from '../lib/offline/offlineMapEngineHost';

/** Marks the Map tab as focused so GPS duty can drop on other tabs. */
export function useMapScreenFocus(): void {
  useFocusEffect(
    useCallback(() => {
      setMapScreenFocused(true);
      releaseOfflineMapEngineViewportForNavigation();
      if (Platform.OS === 'android') {
        ensureMapLibreNetworkForDownload();
      }
      return () => setMapScreenFocused(false);
    }, []),
  );
}
