import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';

import { settingsStyles } from '../../features/settings/settingsStyles';
import { useBatteryOptimization } from '../../hooks/useBatteryOptimization';
import { openBatteryOptimizationSettings, requestBatteryOptimizationExemption } from '../../lib/permissions/batteryOptimization';
import { openSystemSettings, requestBackgroundLocationAccess, requestForegroundLocationAccess } from '../../lib/permissions/locationPermissions';
import { syncBackgroundLocationMonitoring, isBackgroundLocationRunning } from '../../services/backgroundLocationService';
import { useLocationStore } from '../../services/locationService';
import { t } from '../../i18n';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack, Card, Screen, SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

export function SettingsGpsScreen() {
  const { colors, minTouch } = useTheme();
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const refreshPermission = useLocationStore((s) => s.refreshPermission);
  const permission = useLocationStore((s) => s.permission);
  const foregroundCanAskAgain = useLocationStore((s) => s.foregroundCanAskAgain);
  const backgroundCanAskAgain = useLocationStore((s) => s.backgroundCanAskAgain);
  const reducedAccuracy = useLocationStore((s) => s.reducedAccuracy);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [backgroundGpsRunning, setBackgroundGpsRunning] = useState(false);
  const batteryStatus = useBatteryOptimization(Platform.OS === 'android');

  const refreshBackgroundStatus = useCallback(async () => {
    await refreshPermission();
    setBackgroundGpsRunning(await isBackgroundLocationRunning());
  }, [refreshPermission]);

  useEffect(() => {
    void refreshBackgroundStatus();
  }, [refreshBackgroundStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshBackgroundStatus();
    }, [refreshBackgroundStatus]),
  );

  async function requestForegroundLocation() {
    const result = await requestForegroundLocationAccess();
    await refreshBackgroundStatus();
    if (result.status === 'granted') {
      showSuccess(t('permissions.foregroundGrantedHint'));
      return;
    }
    if (result.blocked) {
      showInfo(t('permissions.foregroundBlockedHint'));
    } else {
      showInfo(t('permissions.foregroundDeniedHint'));
    }
  }

  async function requestBackgroundLocation() {
    const result = await requestBackgroundLocationAccess();
    await syncBackgroundLocationMonitoring();
    await refreshBackgroundStatus();
    if (result.status !== 'granted') {
      if (result.blocked) {
        showInfo(t('permissions.backgroundBlockedHint'));
      } else {
        showInfo(t('permissions.backgroundDeniedHint'));
      }
    } else {
      showSuccess(t('permissions.backgroundGrantedHint'));
    }
  }

  async function requestBatteryExemption() {
    if (Platform.OS !== 'android') return;
    try {
      await requestBatteryOptimizationExemption();
    } catch {
      await openBatteryOptimizationSettings();
    }
    await syncBackgroundLocationMonitoring();
    await refreshBackgroundStatus();
  }

  const foregroundGranted = permission === 'foreground' || permission === 'background';
  const backgroundGranted = permission === 'background';
  const foregroundBlocked = permission === 'denied' && !foregroundCanAskAgain;
  const backgroundBlocked = foregroundGranted && !backgroundGranted && !backgroundCanAskAgain;

  const permissionLabel =
    permission === 'background'
      ? t('settings.locationBackgroundGranted')
      : permission === 'foreground'
        ? t('settings.locationForegroundGranted')
        : permission === 'denied'
          ? t('settings.locationDenied')
          : t('settings.locationUnknown');

  const batteryLabel =
    batteryStatus === 'exempt'
      ? t('settings.batteryExempt')
      : batteryStatus === 'restricted'
        ? t('settings.batteryRestricted')
        : t('settings.batteryUnknown');

  const backgroundGpsLabel = backgroundGpsRunning ? t('settings.backgroundGpsRunning') : t('settings.backgroundGpsStopped');

  return (
    <Screen testID="screen.settings.gps">
      <Card>
        <Text style={[settingsStyles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
          {permissionLabel}
        </Text>
        {Platform.OS === 'android' ? (
          <Text style={[settingsStyles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
            {batteryLabel}
          </Text>
        ) : null}
        <Text style={[settingsStyles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
          {backgroundGpsLabel}
        </Text>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{t('settings.batteryBody')}</Text>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{t('settings.anchorBackgroundHint')}</Text>
        {reducedAccuracy && foregroundGranted ? (
          <Text style={[settingsStyles.bodyText, { color: colors.warningText }]} accessibilityLiveRegion="polite">
            {t('permissions.reducedAccuracyHint')}
          </Text>
        ) : null}
        <ButtonStack>
          {!foregroundGranted ? (
            <Button
              label={foregroundBlocked ? t('permissions.openSettings') : t('onboarding.locationForeground')}
              variant="secondary"
              onPress={() => void (foregroundBlocked ? openSystemSettings() : requestForegroundLocation())}
              testID="settings.location.foreground"
            />
          ) : null}
          {foregroundGranted && !backgroundGranted ? (
            <Button
              label={backgroundBlocked ? t('permissions.openSettings') : t('settings.requestBackgroundLocation')}
              variant="secondary"
              onPress={() => void (backgroundBlocked ? openSystemSettings() : requestBackgroundLocation())}
              testID="settings.location.background"
            />
          ) : null}
          {Platform.OS === 'android' ? (
            <>
              <Button label={t('settings.exemptBatteryPrompt')} variant="secondary" onPress={() => void requestBatteryExemption()} testID="settings.battery.exempt" />
              <Button label={t('settings.openBatterySettings')} variant="ghost" onPress={() => void openBatteryOptimizationSettings()} testID="settings.battery.open" />
            </>
          ) : null}
        </ButtonStack>
        <SettingsGroup title={t('settings.underwayGpsTitle')}>
          <ToggleRow label={t('settings.keepAwake')} value={keepAwakeUnderway} onChange={(v) => void patchSettings({ keepAwakeUnderway: v })} testID="settings.keepAwake" colors={colors} minTouch={minTouch} />
          <ToggleRow
            label={t('settings.backgroundTracks')}
            value={backgroundTrackRecording}
            onChange={(v) => {
              void patchSettings({ backgroundTrackRecording: v }).then(async () => {
                await syncBackgroundLocationMonitoring();
              });
            }}
            testID="settings.backgroundTracks"
            colors={colors}
            minTouch={minTouch}
          />
        </SettingsGroup>
      </Card>
    </Screen>
  );
}
