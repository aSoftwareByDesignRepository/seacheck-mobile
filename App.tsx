import { AppProviders } from './src/shell/AppProviders';
import { ErrorBoundary } from './src/shell/ErrorBoundary';
import { RootNavigator } from './src/shell/RootNavigator';
import { ConfirmSheet } from './src/ui/ConfirmSheet';
import { DownloadFailureModal } from './src/ui/DownloadFailureModal';
import { GlobalFeedback } from './src/ui/GlobalFeedback';

export default function App() {
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
