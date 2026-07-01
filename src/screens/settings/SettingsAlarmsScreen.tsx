import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AnchorWatchSettingsGroup } from '../../features/settings/AnchorWatchSettingsGroup';
import { settingsStyles } from '../../features/settings/settingsStyles';
import { parseAlarmLimitDisplay } from '../../lib/alarms/alarmLimits';
import { distanceUnitLabel, formatDistanceNm } from '../../lib/geo/units';
import {
  ensureMaritimeAlarmNotifications,
  getMaritimeNotificationPermission,
  openMaritimeNotificationSettings,
  getMaritimeNotificationCanAskAgain,
} from '../../services/maritimeAlarmNotifications';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack, Card, FieldGroup, FieldInput, Screen, SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

export function SettingsAlarmsScreen() {
  const { colors, minTouch } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const alarmSoundEnabled = useSettingsStore((s) => s.alarmSoundEnabled);
  const alarmHapticEnabled = useSettingsStore((s) => s.alarmHapticEnabled);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const alarmLimits = useNavigationStore((s) => s.alarmLimits);
  const patchAlarmLimits = useNavigationStore((s) => s.patchAlarmLimits);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [xteDraft, setXteDraft] = useState(formatDistanceNm(alarmLimits.xteNm, distanceUnit, 2));
  const [arrivalDraft, setArrivalDraft] = useState(formatDistanceNm(alarmLimits.arrivalNm, distanceUnit, 2));
  const [notificationPermission, setNotificationPermission] = useState(getMaritimeNotificationPermission());

  useEffect(() => {
    setXteDraft(formatDistanceNm(alarmLimits.xteNm, distanceUnit, 2));
    setArrivalDraft(formatDistanceNm(alarmLimits.arrivalNm, distanceUnit, 2));
  }, [alarmLimits.xteNm, alarmLimits.arrivalNm, distanceUnit]);

  function commitAlarmLimit(field: 'xteNm' | 'arrivalNm', draft: string, setDraft: (v: string) => void) {
    const current = alarmLimits[field];
    const next = parseAlarmLimitDisplay(draft, distanceUnit, current);
    setDraft(formatDistanceNm(next, distanceUnit, 2));
    if (next !== current) void patchAlarmLimits({ [field]: next });
  }

  async function requestAlarmNotifications() {
    const ok = await ensureMaritimeAlarmNotifications();
    setNotificationPermission(getMaritimeNotificationPermission());
    if (ok) {
      showSuccess(t('settings.alarmNotificationsGranted'));
      return;
    }
    if (getMaritimeNotificationPermission() === 'denied' && !getMaritimeNotificationCanAskAgain()) {
      await openMaritimeNotificationSettings();
    }
    showInfo(t('settings.alarmNotificationsDenied'));
  }

  return (
    <Screen testID="screen.settings.alarms">
      <Card>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{t('settings.alarmsBody')}</Text>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>
          {notificationPermission === 'granted' ? t('settings.alarmNotificationsOn') : t('settings.alarmNotificationsOff')}
        </Text>
        <ButtonStack>
          <Button label={t('settings.alarmNotificationsEnable')} variant="secondary" onPress={() => void requestAlarmNotifications()} testID="settings.alarmNotifications" />
        </ButtonStack>
        <SettingsGroup title={t('settings.alarmFeedbackTitle')}>
          <ToggleRow label={t('settings.alarmSound')} value={alarmSoundEnabled} onChange={(v) => void patchSettings({ alarmSoundEnabled: v })} testID="settings.alarmSound" colors={colors} minTouch={minTouch} />
          <ToggleRow label={t('settings.alarmHaptic')} value={alarmHapticEnabled} onChange={(v) => void patchSettings({ alarmHapticEnabled: v })} testID="settings.alarmHaptic" colors={colors} minTouch={minTouch} />
          <ToggleRow label={t('settings.legAdvanceAuto')} hint={t('settings.legAdvanceAutoHint')} value={legAdvanceAuto} onChange={(v) => void patchSettings({ legAdvanceAuto: v })} testID="settings.legAdvanceAuto" colors={colors} minTouch={minTouch} />
        </SettingsGroup>
        <SettingsGroup title={t('settings.alarmLimitsTitle')}>
          <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>
            {t('settings.alarmLimitsUnitNote', { unit: distanceUnitLabel(distanceUnit) })}
          </Text>
          <FieldGroup label={t('settings.alarmXteLimit', { unit: distanceUnitLabel(distanceUnit) })}>
            <FieldInput
              value={xteDraft}
              onChangeText={setXteDraft}
              onEndEditing={() => commitAlarmLimit('xteNm', xteDraft, setXteDraft)}
              keyboardType="number-pad"
              accessibilityLabel={t('settings.alarmXteLimit', { unit: distanceUnitLabel(distanceUnit) })}
            />
          </FieldGroup>
          <FieldGroup label={t('settings.alarmArrivalLimit', { unit: distanceUnitLabel(distanceUnit) })}>
            <FieldInput
              value={arrivalDraft}
              onChangeText={setArrivalDraft}
              onEndEditing={() => commitAlarmLimit('arrivalNm', arrivalDraft, setArrivalDraft)}
              keyboardType="number-pad"
              accessibilityLabel={t('settings.alarmArrivalLimit', { unit: distanceUnitLabel(distanceUnit) })}
            />
            <Text style={[settingsStyles.bodyText, { color: colors.textMuted, marginTop: 6 }]}>
              {t('settings.alarmArrivalHint', {
                example: formatDistanceNm(0.25, distanceUnit, 2),
                unit: distanceUnitLabel(distanceUnit),
              })}
            </Text>
          </FieldGroup>
        </SettingsGroup>
        <AnchorWatchSettingsGroup />
      </Card>
    </Screen>
  );
}
