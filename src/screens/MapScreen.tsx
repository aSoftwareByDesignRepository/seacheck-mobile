import { NavigationMap } from '../features/map/NavigationMap';
import { ErrorBoundary } from '../shell/ErrorBoundary';

export function MapScreen() {
  return (
    <ErrorBoundary>
      <NavigationMap />
    </ErrorBoundary>
  );
}
