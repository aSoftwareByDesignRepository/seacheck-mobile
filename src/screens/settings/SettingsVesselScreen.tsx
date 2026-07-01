import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { t } from '../../i18n';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../../ui/Button';
import { ButtonStack, Card, FieldGroup, FieldInput, Screen } from '../../ui/Screen';

export function SettingsVesselScreen() {
  const vessel = useSettingsStore((s) => s.vessel);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const [draft, setDraft] = useState(vessel);

  useFocusEffect(
    useCallback(() => {
      setDraft(vessel);
    }, [vessel]),
  );

  async function saveVessel() {
    await useSettingsStore.getState().updateVessel(draft);
    showSuccess(t('common.save'));
  }

  return (
    <Screen testID="screen.settings.vessel">
      <Card>
        <FieldGroup label={t('settings.vesselName')}>
          <FieldInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} accessibilityLabel={t('settings.vesselName')} />
        </FieldGroup>
        <FieldGroup label={t('settings.callSign')}>
          <FieldInput value={draft.callSign} onChangeText={(callSign) => setDraft((d) => ({ ...d, callSign }))} accessibilityLabel={t('settings.callSign')} />
        </FieldGroup>
        <FieldGroup label={t('settings.mmsi')}>
          <FieldInput value={draft.mmsi} onChangeText={(mmsi) => setDraft((d) => ({ ...d, mmsi }))} accessibilityLabel={t('settings.mmsi')} keyboardType="number-pad" />
        </FieldGroup>
        <FieldGroup label={t('settings.homePort')}>
          <FieldInput value={draft.homePort} onChangeText={(homePort) => setDraft((d) => ({ ...d, homePort }))} accessibilityLabel={t('settings.homePort')} />
        </FieldGroup>
        <ButtonStack>
          <Button label={t('common.save')} onPress={() => void saveVessel()} testID="settings.vessel.save" />
        </ButtonStack>
      </Card>
    </Screen>
  );
}
