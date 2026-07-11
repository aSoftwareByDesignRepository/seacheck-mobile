import * as Location from 'expo-location';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { refreshAnchorWatchPromptIfNeeded } from '../../lib/anchor/activateAnchorAlarm';
import {
  openSystemSettings,
  requestBackgroundLocationAccess,
  requestForegroundLocationAccess,
} from '../../lib/permissions/locationPermissions';
import { requestBatteryOptimizationExemption, openBatteryOptimizationSettings } from '../../lib/permissions/batteryOptimization';
import { t } from '../../i18n';
import {
  ensureMaritimeAlarmNotifications,
  openMaritimeNotificationSettings,
} from '../../services/maritimeAlarmNotifications';
import { syncBackgroundLocationMonitoring } from '../../services/backgroundLocationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/tokens';
import { BottomSheet } from '../../ui/BottomSheet';
import { ANCHOR_WATCH_SHEET_PRIORITY } from '../../ui/sheetHost';
import { Button } from '../../ui/Button';
import { ButtonStack } from '../../ui/Screen';

export function AnchorWatchLimitedSheet() {
  const { colors, spacing, minTouch } = useTheme();
  const prompt = useNavigationStore((s) => s.anchorWatchPrompt);
  const dismissPrompt = useNavigationStore((s) => s.dismissAnchorWatchPrompt);

  useEffect(() => {
    if (!prompt?.foregroundGranted || !prompt.backgroundGranted || prompt.backgroundTaskRunning) return;
    void syncBackgroundLocationMonitoring().then(() => refreshAnchorWatchPromptIfNeeded());
  }, [prompt?.foregroundGranted, prompt?.backgroundGranted, prompt?.backgroundTaskRunning]);

  if (!prompt) return null;

  const close = () => dismissPrompt();

  async function afterFixStep() {
    await syncBackgroundLocationMonitoring();
    await refreshAnchorWatchPromptIfNeeded();
  }

  return (
    <BottomSheet
      visible
      onClose={close}
      title={t('map.anchorWatchLimitedTitle')}
      subtitle={t('map.anchorWatchLimitedBody')}
      scrollable
      priority={ANCHOR_WATCH_SHEET_PRIORITY}
      testID="anchorWatch.limited"
      footer={<Button label={t('common.close')} variant="ghost" onPress={close} testID="anchorWatch.close" style={{ minHeight: minTouch }} />}
    >
      <View style={{ gap: spacing.md }}>
        {!prompt.foregroundGranted ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('permissions.foregroundLabel')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('permissions.foregroundNeededBody')}</Text>
            <ButtonStack>
              <Button
                label={t('onboarding.locationForeground')}
                variant="secondary"
                onPress={() => {
                  void requestForegroundLocationAccess().then(async (result) => {
                    if (result.status !== Location.PermissionStatus.GRANTED) {
                      if (result.blocked) await openSystemSettings();
                    }
                    await afterFixStep();
                  });
                }}
                testID="anchorWatch.foreground"
              />
            </ButtonStack>
          </View>
        ) : null}
        {prompt.foregroundGranted && !prompt.backgroundGranted ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('permissions.backgroundLabel')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('permissions.backgroundNeededBody')}</Text>
            <ButtonStack>
              <Button
                label={t('permissions.enableBackground')}
                variant="secondary"
                onPress={() => {
                  void requestBackgroundLocationAccess({ enableBackgroundTracks: false }).then(async (result) => {
                    if (result.status !== Location.PermissionStatus.GRANTED && result.blocked) {
                      await openSystemSettings();
                    }
                    await afterFixStep();
                  });
                }}
                testID="anchorWatch.background"
              />
            </ButtonStack>
          </View>
        ) : null}
        {!prompt.notificationsGranted ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('onboarding.notificationsTitle')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('settings.alarmNotificationsOff')}</Text>
            <ButtonStack>
              <Button
                label={t('settings.alarmNotificationsEnable')}
                variant="secondary"
                onPress={() => {
                  void ensureMaritimeAlarmNotifications().then(async (ok) => {
                    if (!ok) await openMaritimeNotificationSettings();
                    await afterFixStep();
                  });
                }}
                testID="anchorWatch.notifications"
              />
            </ButtonStack>
          </View>
        ) : null}
        {prompt.batteryOptimizationRestricted ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('settings.batteryTitle')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('settings.batteryBody')}</Text>
            <ButtonStack>
              <Button
                label={t('settings.exemptBatteryPrompt')}
                variant="secondary"
                onPress={() => {
                  void requestBatteryOptimizationExemption()
                    .catch(() => openBatteryOptimizationSettings())
                    .then(() => afterFixStep());
                }}
                testID="anchorWatch.battery"
              />
            </ButtonStack>
          </View>
        ) : null}
        {prompt.reducedAccuracy ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('permissions.preciseLocationTitle')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('permissions.reducedAccuracyHint')}</Text>
            <ButtonStack>
              <Button
                label={t('permissions.openSettings')}
                variant="secondary"
                onPress={() => {
                  void openSystemSettings().then(() => afterFixStep());
                }}
                testID="anchorWatch.preciseLocation"
              />
            </ButtonStack>
          </View>
        ) : null}
        {prompt.foregroundGranted && prompt.backgroundGranted && !prompt.backgroundTaskRunning ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('settings.backgroundGpsTitle')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('settings.backgroundGpsStopped')}</Text>
            <ButtonStack>
              <Button
                label={t('settings.restartBackgroundGps')}
                variant="secondary"
                onPress={() => void afterFixStep()}
                testID="anchorWatch.restartGps"
              />
            </ButtonStack>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  blockTitle: { ...typography.body, fontWeight: '700' },
  blockBody: { ...typography.caption, lineHeight: 20 },
});
