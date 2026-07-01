import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { t } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { Card, Screen } from '../../ui/Screen';
import { SettingsMenuRow } from '../../ui/SettingsMenuRow';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'SettingsHome'>;

const MENU: { route: keyof Omit<SettingsStackParamList, 'SettingsHome'>; labelKey: string; hintKey: string; testID: string }[] = [
  { route: 'SettingsDisplay', labelKey: 'settings.menu.display', hintKey: 'settings.menu.displaySummary', testID: 'settings.menu.display' },
  { route: 'SettingsMap', labelKey: 'settings.menu.map', hintKey: 'settings.menu.mapSummary', testID: 'settings.menu.map' },
  { route: 'SettingsUnits', labelKey: 'settings.menu.units', hintKey: 'settings.menu.unitsSummary', testID: 'settings.menu.units' },
  { route: 'SettingsVessel', labelKey: 'settings.menu.vessel', hintKey: 'settings.menu.vesselSummary', testID: 'settings.menu.vessel' },
  { route: 'SettingsGps', labelKey: 'settings.menu.gps', hintKey: 'settings.menu.gpsSummary', testID: 'settings.menu.gps' },
  { route: 'SettingsAlarms', labelKey: 'settings.menu.alarms', hintKey: 'settings.menu.alarmsSummary', testID: 'settings.menu.alarms' },
  { route: 'SettingsAbout', labelKey: 'settings.menu.about', hintKey: 'settings.menu.aboutSummary', testID: 'settings.menu.about' },
];

export function SettingsHomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <Screen testID="screen.settings" title={t('settings.title')} subtitle={t('settings.homeSummary')}>
      <Card style={{ marginBottom: 0 }}>
        {MENU.map((item, index) => (
          <SettingsMenuRow
            key={item.route}
            first={index === 0}
            label={t(item.labelKey as 'settings.menu.display')}
            hint={t(item.hintKey as 'settings.menu.displaySummary')}
            onPress={() => navigation.navigate(item.route)}
            testID={item.testID}
          />
        ))}
      </Card>
    </Screen>
  );
}
