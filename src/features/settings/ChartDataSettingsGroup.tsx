import { StyleSheet, Text } from 'react-native';

import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { SettingsGroup } from '../../ui/Screen';

type Props = {
  first?: boolean;
};

/** Chart-data info — Voyager base tiles + OpenSeaMap seamarks (no user-facing style toggles). */
export function ChartDataSettingsGroup({ first }: Props) {
  const { colors } = useTheme();

  return (
    <SettingsGroup title={t('settings.chartDataTitle')} hint={t('settings.chartDataSummary')} first={first}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartDataLayersBody')}</Text>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
});
