import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';

const UNLOCK_HOLD_MS = 1500;

type Props = {
  onUnlock: () => void;
};

/** Requires a deliberate hold to unlock — avoids accidental unlock at sea. */
export function ScreenLockOverlay({ onUnlock }: Props) {
  const { colors, minTouch } = useTheme();
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setProgress(0);
  }, []);

  const onPressIn = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!startRef.current) return;
      const elapsed = Date.now() - startRef.current;
      setProgress(Math.min(1, elapsed / UNLOCK_HOLD_MS));
      if (elapsed >= UNLOCK_HOLD_MS) {
        clearTimer();
        onUnlock();
      }
    }, 50);
  }, [clearTimer, onUnlock]);

  const onPressOut = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.unlockScreen')}
      accessibilityHint={t('map.unlockScreenHint')}
      accessibilityViewIsModal
      accessibilityValue={progress > 0 ? { text: `${Math.round(progress * 100)}%` } : undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.overlay, { backgroundColor: `${colors.background}F2`, minHeight: minTouch }]}
      testID="map.screenLockOverlay"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('map.screenLocked')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('map.unlockScreen')}</Text>
      {progress > 0 ? (
        <View style={[styles.progressTrack, { borderColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  hint: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  progressTrack: { width: '60%', maxWidth: 280, height: 6, borderRadius: 3, borderWidth: 1, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
