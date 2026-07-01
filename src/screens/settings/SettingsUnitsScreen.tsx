import { View } from 'react-native';

import { settingsStyles } from '../../features/settings/settingsStyles';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { FilterChip } from '../../ui/FilterChip';
import { Card, Screen, SettingsGroup } from '../../ui/Screen';

export function SettingsUnitsScreen() {
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const bearingReference = useSettingsStore((s) => s.bearingReference);

  return (
    <Screen testID="screen.settings.units">
      <Card>
        <SettingsGroup title={t('settings.sogUnit')} hint={t('settings.sogUnitHint')} first>
          <View style={settingsStyles.chipRow}>
            {(['kn', 'mph', 'kmh', 'ms'] as const).map((u) => (
              <FilterChip key={u} label={u} selected={sogUnit === u} onPress={() => void patchSettings({ sogUnit: u })} testID={`settings.sog.${u}`} />
            ))}
          </View>
        </SettingsGroup>

        <SettingsGroup title={t('settings.distanceUnit')}>
          <View style={settingsStyles.chipRow}>
            {(['nm', 'km', 'sm'] as const).map((u) => (
              <FilterChip key={u} label={u} selected={distanceUnit === u} onPress={() => void patchSettings({ distanceUnit: u })} testID={`settings.dist.${u}`} />
            ))}
          </View>
        </SettingsGroup>

        <SettingsGroup title={t('settings.bearingRef')} hint={t('settings.bearingRefHint')}>
          <View style={settingsStyles.chipRow}>
            <FilterChip label={t('settings.bearingTrue')} selected={bearingReference === 'true'} onPress={() => void patchSettings({ bearingReference: 'true' })} testID="settings.bearing.true" />
            <FilterChip label={t('settings.bearingMagnetic')} selected={bearingReference === 'magnetic'} onPress={() => void patchSettings({ bearingReference: 'magnetic' })} testID="settings.bearing.magnetic" />
          </View>
        </SettingsGroup>
      </Card>
    </Screen>
  );
}
