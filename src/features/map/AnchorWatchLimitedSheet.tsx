import * as Location from 'expo-location';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { refreshAnchorWatchPromptIfNeeded } from '../../lib/anchor/activateAnchorAlarm';
import { requestBackgroundLocationAccess, openSystemSettings } from '../../lib/permissions/locationPermissions';
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
import { Button } from '../../ui/Button';
import { ButtonStack } from '../../ui/Screen';

export function AnchorWatchLimitedSheet() {
  const { colors, spacing, minTouch } = useTheme();
  const prompt = useNavigationStore((s) => s.anchorWatchPrompt);
  const setPrompt = useNavigationStore((s) => s.setAnchorWatchPrompt);

  useEffect(() => {
    if (!prompt?.backgroundGranted || prompt.backgroundTaskRunning) return;
    void syncBackgroundLocationMonitoring().then(() => refreshAnchorWatchPromptIfNeeded());
  }, [prompt?.backgroundGranted, prompt?.backgroundTaskRunning]);

  if (!prompt) return null;

  const close = () => setPrompt(null);

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
      testID="anchorWatch.limited"
      footer={<Button label={t('common.close')} variant="ghost" onPress={close} testID="anchorWatch.close" style={{ minHeight: minTouch }} />}
    >
      <View style={{ gap: spacing.md }}>
        {!prompt.backgroundGranted ? (
          <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('permissions.backgroundLabel')}</Text>
            <Text style={[styles.blockBody, { color: colors.textMuted }]}>{t('permissions.backgroundNeededBody')}</Text>
            <ButtonStack>
              <Button
                label={t('permissions.enableBackground')}
                variant="secondary"
                onPress={() => {
                  void requestBackgroundLocationAccess({ enableBackgroundTracks: false }).then(async (s) => {
                    if (s !== Location.PermissionStatus.GRANTED) await openSystemSettings();
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
        {prompt.backgroundGranted && !prompt.backgroundTaskRunning ? (
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
