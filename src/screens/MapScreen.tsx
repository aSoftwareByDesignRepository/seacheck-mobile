import { NavigationMap } from '../features/map/NavigationMap';
import { useMapScreenFocus } from '../hooks/useMapScreenFocus';
import { ErrorBoundary } from '../shell/ErrorBoundary';

export function MapScreen() {
  useMapScreenFocus();
  return (
    <ErrorBoundary>
      <NavigationMap />
    </ErrorBoundary>
  );
}
