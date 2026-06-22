import { AppProviders } from './src/shell/AppProviders';
import { RootNavigator } from './src/shell/RootNavigator';
import { GlobalFeedback } from './src/ui/GlobalFeedback';

export default function App() {
  return (
    <AppProviders>
      <GlobalFeedback />
      <RootNavigator />
    </AppProviders>
  );
}
