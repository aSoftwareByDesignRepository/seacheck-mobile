import * as Application from 'expo-application';
import { Text } from 'react-native';

import { settingsStyles } from '../../features/settings/settingsStyles';
import {
  copyMaydayToClipboard,
  maydayCopyFeedbackKey,
  maydayUnavailableMessage,
} from '../../lib/emergency/copyMaydayClipboard';
import { MAP_ATTRIBUTION } from '../../map/constants';
import { t } from '../../i18n';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack, Card, Screen } from '../../ui/Screen';

export function SettingsAboutScreen() {
  const { colors } = useTheme();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const vessel = useSettingsStore((s) => s.vessel);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showError = useFeedbackStore((s) => s.showError);
  const appVersion = Application.nativeApplicationVersion ?? '0.1.0';

  async function copyMayday() {
    const quality = await copyMaydayToClipboard(vessel, coordFormat);
    if (quality === 'unavailable') {
      showError(maydayUnavailableMessage());
      return;
    }
    const key = maydayCopyFeedbackKey(quality);
    if (quality === 'fresh') showSuccess(t(key));
    else showInfo(t(key));
  }

  return (
    <Screen testID="screen.settings.about">
      <Card>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{t('settings.disclaimerBody')}</Text>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{MAP_ATTRIBUTION}</Text>
        <Text style={[settingsStyles.version, { color: colors.text }]}>{t('settings.version', { v: appVersion })}</Text>
      </Card>

      <Card>
        <ButtonStack>
          <Button label={t('settings.emergencyCopy')} variant="secondary" onPress={() => void copyMayday()} testID="settings.emergency.copy" />
        </ButtonStack>
      </Card>
    </Screen>
  );
}
