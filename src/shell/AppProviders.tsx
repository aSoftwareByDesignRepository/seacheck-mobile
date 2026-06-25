import { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider, initI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeContext';
import { SheetHostProvider } from '../ui/sheetHost';

initI18n();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <SheetHostProvider>{children}</SheetHostProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
