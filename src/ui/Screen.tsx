import { PropsWithChildren, ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

const TAB_SCREEN_EDGES: Edge[] = ['top', 'left', 'right'];

type ScreenProps = PropsWithChildren<{
  testID?: string;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}>;

export function Screen({ testID, title, subtitle, loading, error, onRetry, children }: ScreenProps) {
  const { colors, spacing } = useTheme();

  if (loading && !children) {
    return (
      <SafeAreaView edges={TAB_SCREEN_EDGES} testID={testID} style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={t('common.loading')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={TAB_SCREEN_EDGES} testID={testID} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }]}
      >
        {title ? (
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        {error ? (
          <View
            style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            {onRetry ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.retry')} onPress={onRetry} style={styles.retry}>
                <Text style={[styles.retryText, { color: colors.primary }]}>{t('common.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FieldLabel({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.textMuted }]}>{children}</Text>;
}

export function FieldInput({
  value,
  onChangeText,
  onEndEditing,
  placeholder,
  accessibilityLabel,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onEndEditing?: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  const { colors, spacing, minTouch } = useTheme();
  return (
    <TextInputLike
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      keyboardType={keyboardType}
      colors={colors}
      spacing={spacing}
      minTouch={minTouch}
    />
  );
}

function TextInputLike({
  value,
  onChangeText,
  onEndEditing,
  placeholder,
  accessibilityLabel,
  keyboardType,
  colors,
  spacing,
  minTouch,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onEndEditing?: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  keyboardType?: 'default' | 'number-pad';
  colors: { surface: string; border: string; text: string; textMuted: string };
  spacing: { md: number };
  minTouch: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={accessibilityLabel}
      keyboardType={keyboardType}
      style={[
        styles.input,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          color: colors.text,
          padding: spacing.md,
          minHeight: minTouch,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 20, lineHeight: 22 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  errorText: { fontSize: 15, lineHeight: 21 },
  retry: { marginTop: 12, minHeight: 48, justifyContent: 'center' },
  retryText: { fontWeight: '600', fontSize: 16 },
  card: { borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, fontSize: 16, marginBottom: 16 },
});
