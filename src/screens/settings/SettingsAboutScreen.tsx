import * as Application from 'expo-application';
import { Text } from 'react-native';

import { NavigationDisclaimer } from '../../features/legal/NavigationDisclaimer';
import { settingsStyles } from '../../features/settings/settingsStyles';
import { EXTERNAL_LINKS } from '../../lib/constants/externalLinks';
import { privacyPolicyUrl, termsOfUseUrl } from '../../lib/legal/legalUrls';
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
import { ExternalLinkRow } from '../../ui/ExternalLinkRow';
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
        <Text style={[settingsStyles.sectionTitle, { color: colors.text }]}>{t('settings.aboutTitle')}</Text>
        <NavigationDisclaimer testIDPrefix="settings.about" />
      </Card>

      <Card>
        <Text style={[settingsStyles.bodyText, { color: colors.textMuted }]}>{MAP_ATTRIBUTION}</Text>
        <ExternalLinkRow
          label={t('legal.cartoAttribution')}
          url={EXTERNAL_LINKS.cartoAttribution}
          testID="settings.about.carto"
        />
        <ExternalLinkRow
          label={t('legal.privacyPolicy')}
          url={privacyPolicyUrl()}
          testID="settings.about.privacy"
        />
        <ExternalLinkRow
          label={t('legal.termsOfUse')}
          url={termsOfUseUrl()}
          testID="settings.about.terms"
        />
        <ExternalLinkRow
          label={t('legal.publisher')}
          url={EXTERNAL_LINKS.publisher}
          testID="settings.about.publisher"
        />
        <Text style={[settingsStyles.publisherHint, { color: colors.textMuted }]}>{t('legal.publisherHint')}</Text>
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
