import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  openSystemSettings,
  permissionStatusLabel,
  readLocationPermissionSnapshot,
  requestBackgroundLocationAccess,
  requestForegroundLocationAccess,
} from '../lib/permissions/locationPermissions';
import { openBatteryOptimizationSettings, requestBatteryOptimizationExemption } from '../lib/permissions/batteryOptimization';
import { ensureMaritimeAlarmNotifications } from '../services/maritimeAlarmNotifications';
import { t } from '../i18n';
import { requestConfirm } from '../store/confirmStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { NavigationDisclaimer } from '../features/legal/NavigationDisclaimer';
import { Button } from '../ui/Button';
import { OnboardingStepIndicator } from '../ui/OnboardingStepIndicator';
import { Card } from '../ui/Screen';

type Step = 'disclaimer' | 'location' | 'battery' | 'finish';

function resumeStep(
  foreground: Location.PermissionStatus | null,
  batteryGuidanceAcknowledged: boolean,
): Step {
  if (batteryGuidanceAcknowledged) return 'finish';
  if (foreground === Location.PermissionStatus.GRANTED) return 'battery';
  return 'disclaimer';
}

export function OnboardingScreen() {
  const { colors, spacing, minTouch } = useTheme();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const acknowledgeBatteryGuidance = useSettingsStore((s) => s.acknowledgeBatteryGuidance);
  const batteryGuidanceAcknowledged = useSettingsStore((s) => s.batteryGuidanceAcknowledged);
  const showError = useFeedbackStore((s) => s.showError);
  const [step, setStep] = useState<Step>('disclaimer');
  const [foregroundStatus, setForegroundStatus] = useState<Location.PermissionStatus | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<Location.PermissionStatus | null>(null);
  const [foregroundCanAskAgain, setForegroundCanAskAgain] = useState(true);
  const [backgroundCanAskAgain, setBackgroundCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);

  const foregroundGranted = foregroundStatus === Location.PermissionStatus.GRANTED;
  const backgroundGranted = backgroundStatus === Location.PermissionStatus.GRANTED;
  const foregroundBlocked =
    foregroundStatus === Location.PermissionStatus.DENIED && !foregroundCanAskAgain;
  const backgroundBlocked =
    foregroundGranted &&
    backgroundStatus === Location.PermissionStatus.DENIED &&
    !backgroundCanAskAgain;

  const refreshPermissionStatuses = useCallback(async () => {
    const snapshot = await readLocationPermissionSnapshot();
    setForegroundStatus(snapshot.foreground);
    setBackgroundStatus(snapshot.background);
    setForegroundCanAskAgain(snapshot.foregroundCanAskAgain);
    setBackgroundCanAskAgain(snapshot.backgroundCanAskAgain);
    return snapshot;
  }, []);

  useEffect(() => {
    void (async () => {
      const statuses = await refreshPermissionStatuses();
      setStep(resumeStep(statuses.foreground, batteryGuidanceAcknowledged));
      setResumeChecked(true);
    })();
  }, [batteryGuidanceAcknowledged, refreshPermissionStatuses]);

  useEffect(() => {
    if (step !== 'location' || !foregroundGranted) return;
    setStep('battery');
  }, [foregroundGranted, step]);

  useEffect(() => {
    if (step !== 'battery' || !batteryGuidanceAcknowledged) return;
    setStep('finish');
  }, [batteryGuidanceAcknowledged, step]);

  async function handleForegroundLocation() {
    if (foregroundBlocked) {
      await openSystemSettings();
      await refreshPermissionStatuses();
      return;
    }
    setBusy(true);
    try {
      const result = await requestForegroundLocationAccess();
      setForegroundStatus(result.status);
      setForegroundCanAskAgain(!result.blocked);
      if (result.blocked) await openSystemSettings();
    } finally {
      setBusy(false);
    }
  }

  async function handleBackgroundLocation() {
    if (backgroundBlocked) {
      await openSystemSettings();
      await refreshPermissionStatuses();
      return;
    }
    setBusy(true);
    try {
      const result = await requestBackgroundLocationAccess();
      setBackgroundStatus(result.status);
      setBackgroundCanAskAgain(!result.blocked);
      if (result.status === Location.PermissionStatus.GRANTED) {
        setForegroundStatus(Location.PermissionStatus.GRANTED);
      }
      if (result.blocked) await openSystemSettings();
    } finally {
      setBusy(false);
    }
  }

  async function acceptDisclaimer() {
    const statuses = await refreshPermissionStatuses();
    setStep(statuses.foreground === Location.PermissionStatus.GRANTED ? 'battery' : 'location');
  }

  async function continueFromLocation() {
    if (foregroundStatus !== Location.PermissionStatus.GRANTED) {
      const proceedForeground = await requestConfirm({
        title: t('permissions.foregroundNeededTitle'),
        message: t('permissions.foregroundNeededBody'),
        confirmLabel: t('onboarding.locationForeground'),
        cancelLabel: t('onboarding.locationSkip'),
      });
      if (proceedForeground) void handleForegroundLocation();
      else setStep('battery');
      return;
    }
    setStep('battery');
  }

  async function openBatterySettings() {
    await acknowledgeBatteryGuidance();
    if (Platform.OS === 'android') {
      try {
        await requestBatteryOptimizationExemption();
      } catch {
        await openBatteryOptimizationSettings();
      }
    }
  }

  async function handleFinish() {
    setBusy(true);
    try {
      await ensureMaritimeAlarmNotifications();
      await completeOnboarding();
      try {
        const { initializeAppServices } = await import('../lib/permissions/initializeAppServices');
        await initializeAppServices({ requestNotifications: true });
      } catch (error) {
        console.warn('[OnboardingScreen] post-onboarding services failed', error);
      }
    } catch (error) {
      console.error('[OnboardingScreen] finish failed', error);
      showError(t('boot.failedBody'));
    } finally {
      setBusy(false);
    }
  }

  if (!resumeChecked) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} testID="screen.onboarding">
        <View style={[styles.content, { padding: spacing.xl }]}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('onboarding.title')}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted, textAlign: 'center' }]}>{t('boot.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} testID="screen.onboarding">
      <View style={[styles.content, { padding: spacing.xl }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('onboarding.title')}
        </Text>
        <OnboardingStepIndicator current={step} />

        {step === 'disclaimer' ? (
          <ScrollView
            style={styles.disclaimerScroll}
            contentContainerStyle={styles.disclaimerScrollContent}
            showsVerticalScrollIndicator
          >
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.disclaimerTitle')}</Text>
              <NavigationDisclaimer testIDPrefix="onboarding.disclaimer" />
              <View style={{ marginTop: spacing.md }}>
                <Button label={t('onboarding.acceptDisclaimer')} onPress={() => void acceptDisclaimer()} testID="onboarding.disclaimer.continue" />
              </View>
            </Card>
          </ScrollView>
        ) : null}

        {step === 'location' ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.locationTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.locationBody')}</Text>
            {foregroundStatus ? (
              <Text style={[styles.status, { color: colors.text }]} accessibilityLiveRegion="polite">
                {t('permissions.foregroundLabel')}: {permissionStatusLabel(foregroundStatus)}
              </Text>
            ) : null}
            {backgroundStatus ? (
              <Text style={[styles.status, { color: colors.text }]} accessibilityLiveRegion="polite">
                {t('permissions.backgroundLabel')}: {permissionStatusLabel(backgroundStatus)}
              </Text>
            ) : null}
            {foregroundGranted ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('onboarding.locationReady')}</Text>
            ) : null}
            {foregroundBlocked ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('permissions.foregroundBlockedHint')}</Text>
            ) : null}
            {backgroundBlocked ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('permissions.backgroundBlockedHint')}</Text>
            ) : null}
            <View style={[styles.actions, { minHeight: minTouch }]}>
              {!foregroundGranted ? (
                <Button
                  label={foregroundBlocked ? t('permissions.openSettings') : t('onboarding.locationForeground')}
                  onPress={() => void handleForegroundLocation()}
                  loading={busy}
                  testID="onboarding.location.foreground"
                />
              ) : null}
              {!backgroundGranted ? (
                <Button
                  label={backgroundBlocked ? t('permissions.openSettings') : t('onboarding.locationBackground')}
                  variant="secondary"
                  onPress={() => void handleBackgroundLocation()}
                  loading={busy}
                  disabled={!foregroundGranted && foregroundStatus !== null && !foregroundBlocked}
                  testID="onboarding.location.background"
                />
              ) : null}
              {!foregroundGranted && foregroundStatus === null ? (
                <Text style={[styles.hint, { color: colors.textMuted }]}>{t('onboarding.locationOrderHint')}</Text>
              ) : null}
              <Button label={t('common.continue')} onPress={() => void continueFromLocation()} testID="onboarding.location.continue" />
              {!foregroundGranted ? (
                <Button label={t('onboarding.locationSkip')} variant="secondary" onPress={() => setStep('battery')} testID="onboarding.location.skip" />
              ) : null}
            </View>
          </Card>
        ) : null}

        {step === 'battery' ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.batteryTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.batteryBody')}</Text>
            <View style={[styles.actions, { minHeight: minTouch }]}>
              {Platform.OS === 'android' ? (
                <Button
                  label={t('settings.exemptBatteryPrompt')}
                  variant="secondary"
                  onPress={() => void openBatterySettings()}
                  testID="onboarding.battery.settings"
                />
              ) : null}
              <Button
                label={t('onboarding.batteryAcknowledge')}
                onPress={() => {
                  void acknowledgeBatteryGuidance();
                  setStep('finish');
                }}
                testID="onboarding.battery.ack"
              />
            </View>
          </Card>
        ) : null}

        {step === 'finish' ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.notificationsTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.notificationsBody')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.downloadReminder')}</Text>
            <Button label={t('onboarding.finish')} onPress={() => void handleFinish()} loading={busy} testID="onboarding.finish" />
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  status: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actions: { gap: 12 },
  disclaimerScroll: { flexGrow: 0, maxHeight: '72%' },
  disclaimerScrollContent: { paddingBottom: 8 },
});
