import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { setMapScreenFocused } from '../lib/map/mapScreenFocus';

/** Marks the Map tab as focused so GPS duty can drop on other tabs. */
export function useMapScreenFocus(): void {
  useFocusEffect(
    useCallback(() => {
      setMapScreenFocused(true);
      return () => setMapScreenFocused(false);
    }, []),
  );
}
