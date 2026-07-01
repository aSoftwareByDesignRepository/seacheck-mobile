import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { useMobLayoutSwitch } from '../../hooks/useMobLayoutSwitch';
import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { useSafetyActionsMetrics } from '../../hooks/useSafetyActionsMetrics';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { MobActionButton } from './MobActionButton';

const UNLOCK_HOLD_MS = 1500;

type Props = {
  visible: boolean;
  onUnlock: () => void;
};

/** Requires a deliberate hold to unlock — MOB stays reachable for emergencies. */
export function ScreenLockOverlay({ visible, onUnlock }: Props) {
  const { colors, minTouch } = useTheme();
  const layout = useMapBottomLayout({ showSideActions: true });
  const layoutPreset = useEffectiveLayoutPreset();
  const isInstrumentsOnly = layoutPreset === 'instruments-only';
  const mobMetrics = useSafetyActionsMetrics('side', !isInstrumentsOnly);
  const switchLayoutOnMob = useMobLayoutSwitch();
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!visible) clearTimer();
  }, [visible, clearTimer]);

  const onUnlockPressIn = useCallback(() => {
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

  const onUnlockPressOut = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Android back must not unlock — only the deliberate hold gesture does.
      }}
    >
      <View style={styles.host} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.unlockScreen')}
          accessibilityHint={t('map.unlockScreenHint')}
          accessibilityValue={progress > 0 ? { text: `${Math.round(progress * 100)}%` } : undefined}
          onPressIn={onUnlockPressIn}
          onPressOut={onUnlockPressOut}
          style={[styles.unlockPane, { backgroundColor: `${colors.background}F2`, minHeight: minTouch }]}
          testID="map.screenLockOverlay"
        >
          <Text style={[styles.title, { color: colors.text }]}>{t('map.screenLocked')}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('map.unlockScreen')}</Text>
          <Text style={[styles.mobHint, { color: colors.textMuted }]}>{t('map.screenLockMobHint')}</Text>
          {progress > 0 ? (
            <View style={[styles.progressTrack, { borderColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          ) : null}
        </Pressable>

        <View
          pointerEvents="box-none"
          style={[
            styles.mobHost,
            isInstrumentsOnly
              ? { top: layout.top, right: layout.right, alignItems: 'flex-end' }
              : { bottom: layout.actionsColumnBottom, right: layout.right, alignItems: 'flex-end' },
          ]}
        >
          <MobActionButton
            metrics={mobMetrics}
            onMobDropped={() => {
              switchLayoutOnMob();
              onUnlock();
            }}
            testID="map.mob.locked"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  unlockPane: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  hint: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  mobHint: { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20, maxWidth: 320 },
  progressTrack: { width: '60%', maxWidth: 280, height: 6, borderRadius: 3, borderWidth: 1, overflow: 'hidden' },
  progressFill: { height: '100%' },
  mobHost: { position: 'absolute', zIndex: 2, elevation: 2 },
});
