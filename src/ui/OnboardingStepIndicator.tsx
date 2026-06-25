import { StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../theme/ThemeContext';

const STEPS = ['disclaimer', 'location', 'battery', 'finish'] as const;

type Step = (typeof STEPS)[number];

const STEP_LABEL_KEYS: Record<Step, 'onboarding.stepDisclaimer' | 'onboarding.stepLocation' | 'onboarding.stepBattery' | 'onboarding.stepFinish'> = {
  disclaimer: 'onboarding.stepDisclaimer',
  location: 'onboarding.stepLocation',
  battery: 'onboarding.stepBattery',
  finish: 'onboarding.stepFinish',
};

type Props = {
  current: Step;
};

export function OnboardingStepIndicator({ current }: Props) {
  const { colors, spacing } = useTheme();
  const currentIndex = STEPS.indexOf(current);

  return (
    <View
      style={[styles.wrap, { marginBottom: spacing.lg }]}
      accessibilityRole="summary"
      accessibilityLabel={t('onboarding.progress', { step: currentIndex + 1, total: STEPS.length })}
    >
      <View style={styles.dots}>
        {STEPS.map((step, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          return (
            <View
              key={step}
              style={[
                styles.dot,
                {
                  backgroundColor: active ? colors.primary : done ? colors.success : colors.border,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityElementsHidden
            />
          );
        })}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t(STEP_LABEL_KEYS[current])}</Text>
      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {t('onboarding.stepCounter', { current: currentIndex + 1, total: STEPS.length })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  counter: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
