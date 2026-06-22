import { StyleSheet, Text, View } from 'react-native';

import { formatCountdownMs } from '../../lib/racing/racingGeo';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  remainingMs: number | null;
  isActive: boolean;
  isStarted: boolean;
};

export function RaceCountdownBanner({ remainingMs, isActive, isStarted }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const clearCountdown = useNavigationStore((s) => s.setRaceStartAt);

  if (!isActive && !isStarted) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: isStarted ? colors.successBg : colors.primary, borderColor: colors.border, marginBottom: spacing.sm, minHeight: minTouch }]}
      testID="race.countdown.banner"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.label, { color: isStarted ? colors.success : colors.primaryText }]}>
        {isStarted ? t('race.countdownStarted') : t('race.countdownLabel')}
      </Text>
      <Text style={[styles.time, { color: isStarted ? colors.success : colors.primaryText }]}>
        {isStarted ? t('race.countdownGo') : formatCountdownMs(remainingMs ?? 0)}
      </Text>
      <Button label={t('race.countdownClear')} variant="secondary" onPress={() => void clearCountdown(null)} testID="race.countdown.clear" />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  time: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
