import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Screen';

type Step = 'disclaimer' | 'location' | 'battery' | 'finish';

export function OnboardingScreen() {
  const { colors, spacing, minTouch } = useTheme();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const acknowledgeBatteryGuidance = useSettingsStore((s) => s.acknowledgeBatteryGuidance);
  const [step, setStep] = useState<Step>('disclaimer');
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestForegroundLocation() {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status);
    } finally {
      setBusy(false);
    }
  }

  async function requestBackgroundLocation() {
    setBusy(true);
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      setLocationStatus(status);
    } finally {
      setBusy(false);
    }
  }

  async function openBatterySettings() {
    await acknowledgeBatteryGuidance();
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} testID="screen.onboarding">
      <View style={[styles.content, { padding: spacing.xl }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('onboarding.title')}
        </Text>

        {step === 'disclaimer' ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.disclaimerTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.disclaimerBody')}</Text>
            <Button label={t('onboarding.acceptDisclaimer')} onPress={() => setStep('location')} testID="onboarding.disclaimer.continue" />
          </Card>
        ) : null}

        {step === 'location' ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.locationTitle')}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.locationBody')}</Text>
            {locationStatus ? (
              <Text style={[styles.status, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
                {locationStatus}
              </Text>
            ) : null}
            <View style={[styles.actions, { minHeight: minTouch }]}>
              <Button
                label={t('onboarding.locationForeground')}
                onPress={() => void requestForegroundLocation()}
                loading={busy}
                testID="onboarding.location.foreground"
              />
              <Button
                label={t('onboarding.locationBackground')}
                variant="secondary"
                onPress={() => void requestBackgroundLocation()}
                loading={busy}
                testID="onboarding.location.background"
              />
              <Button label={t('common.continue')} onPress={() => setStep('battery')} testID="onboarding.location.continue" />
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
                  label={t('settings.openBatterySettings')}
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
            <Text style={[styles.body, { color: colors.textMuted, marginBottom: 16 }]}>{t('onboarding.downloadReminder')}</Text>
            <Button
              label={t('onboarding.finish')}
              onPress={() => void completeOnboarding()}
              testID="onboarding.finish"
            />
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  status: { fontSize: 14, marginBottom: 12 },
  actions: { gap: 12 },
});
