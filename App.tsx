import { useEffect } from 'react';

import { configureChartTileHttp } from './src/lib/map/configureChartTileHttp';
import { AppProviders } from './src/shell/AppProviders';
import { ErrorBoundary } from './src/shell/ErrorBoundary';
import { installGlobalErrorLogging } from './src/shell/installGlobalErrorLogging';
import { RootNavigator } from './src/shell/RootNavigator';
import { ConfirmSheet } from './src/ui/ConfirmSheet';
import { DownloadFailureModal } from './src/ui/DownloadFailureModal';
import { GlobalFeedback } from './src/ui/GlobalFeedback';

// OSM rejects anonymous MapLibre OkHttp clients with solid-colour placeholder tiles.
// Register User-Agent BEFORE the first React paint — useEffect is too late for cold start.
configureChartTileHttp();

export default function App() {
  useEffect(() => {
    configureChartTileHttp();
    installGlobalErrorLogging();
  }, []);

  return (
    <AppProviders>
      <ErrorBoundary>
        <GlobalFeedback />
        <DownloadFailureModal />
        <ConfirmSheet />
        <RootNavigator />
      </ErrorBoundary>
    </AppProviders>
  );
}
