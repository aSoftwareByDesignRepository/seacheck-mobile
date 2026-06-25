import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

type Props = PropsWithChildren<{
  fallback?: ReactNode;
}>;

type State = {
  error: Error | null;
};

function ThemedErrorFallback({ onReset }: { onReset: () => void }) {
  const { colors, spacing, minTouch } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <View style={[styles.box, { padding: spacing.xl }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('common.errorTitle')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('common.errorBody')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          onPress={onReset}
          style={[styles.retry, { backgroundColor: colors.primary, minHeight: minTouch }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryText }]}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Catches render errors so a single screen failure does not white-screen the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return <ThemedErrorFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center' },
  box: { gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  retry: { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  retryText: { fontSize: 16, fontWeight: '700' },
});
